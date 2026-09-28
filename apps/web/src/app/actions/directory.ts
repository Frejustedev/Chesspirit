"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const ORG_TYPES = [
  "club",
  "school",
  "organizer",
  "association",
  "departmental_league",
  "federation",
  "vendor",
  "content_creator",
  "media",
  "university",
  "company",
] as const;
const opt = (s: z.ZodString) => s.optional().or(z.literal("").transform(() => undefined));

function done() {
  revalidatePath("/annuaire", "layout");
  revalidatePath("/admin/annuaire");
}

const orgSchema = z.object({
  type: z.enum(ORG_TYPES),
  name: z.string().trim().min(2).max(120),
  description: opt(z.string().trim().max(2000)),
  department: z
    .enum(BENIN_DEPARTMENTS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  city: opt(z.string().trim().max(80)),
  address: opt(z.string().trim().max(200)),
  phone: opt(
    z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{8,20}$/),
  ),
  email: opt(z.string().trim().email().max(200)),
  website: opt(
    z
      .string()
      .trim()
      .url()
      .max(200)
      .regex(/^https?:\/\//),
  ),
  lat: z.coerce
    .number()
    .min(5.5)
    .max(13)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  lng: z.coerce
    .number()
    .min(0.5)
    .max(4)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  website_hp: z.string().optional(),
});

/** Proposition d'une structure : publiée après validation par l'équipe. */
export async function proposeOrganizationAction(
  _prev: unknown,
  form: FormData,
): Promise<Result | null> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = orgSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  if (p.data.website_hp) return { ok: true };
  const org = { ...p.data, website_hp: undefined };
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_organization", {
    p_org: { ...org, lat: org.lat?.toString() ?? "", lng: org.lng?.toString() ?? "" },
  });
  if (error) return { ok: false, error: "server" };
  done();
  return { ok: true };
}

export async function claimOrganizationAction(
  _prev: unknown,
  form: FormData,
): Promise<Result | null> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = z
    .object({
      organizationId: uuid,
      role: z.string().trim().min(2).max(80),
      message: opt(z.string().trim().max(2000)),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("listing_claims").insert({
    organization_id: p.data.organizationId,
    profile_id: session.profile.id,
    role_in_org: p.data.role,
    message: p.data.message ?? null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "already_claimed" : "server" };
  done();
  return { ok: true };
}

const jobSchema = z.object({
  kind: z.enum(["coach", "arbiter", "organizer", "other"]),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(4000),
  city: opt(z.string().trim().max(80)),
  department: z
    .enum(BENIN_DEPARTMENTS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  contract: z
    .enum(["volunteer", "freelance", "part_time", "full_time", "mission"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  pay_note: opt(z.string().trim().max(200)),
  contact: z.string().trim().min(5).max(200),
  expires_on: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function postJobAction(_prev: unknown, form: FormData): Promise<Result | null> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = jobSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_posts")
    .insert({ ...p.data, posted_by: session.profile.id });
  if (error) return { ok: false, error: "server" };
  done();
  return { ok: true };
}

const arbiterSchema = z.object({
  title: z
    .enum(["IA", "FA", "NA", "regional", "club", "trainee"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  zone: opt(z.string().trim().max(120)),
  availability: opt(z.string().trim().max(500)),
  languages: z.array(z.enum(["fr", "en", "fon"])).min(1),
  is_public: z.boolean(),
});

export async function saveArbiterProfileAction(raw: unknown): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (session.profile.is_minor) return { ok: false, error: "minor" };
  const p = arbiterSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("arbiter_profiles").upsert(
    {
      profile_id: session.profile.id,
      title: p.data.title ?? null,
      zone: p.data.zone ?? null,
      availability: p.data.availability ?? null,
      languages: p.data.languages,
      is_public: p.data.is_public,
    },
    { onConflict: "profile_id" },
  );
  if (error) return { ok: false, error: "server" };
  done();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Modération (administrateurs ; droits vérifiés par la base)
// ---------------------------------------------------------------------------
export async function moderateOrganizationAction(
  id: string,
  patch: { is_public?: boolean; verified?: boolean; remove?: boolean },
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const q = patch.remove
    ? supabase.from("organizations").delete().eq("id", id).select("id")
    : supabase
        .from("organizations")
        .update({
          ...(patch.is_public !== undefined ? { is_public: patch.is_public } : {}),
          ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
        })
        .eq("id", id)
        .select("id");
  const { data, error } = await q;
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function decideClaimAction(id: string, approve: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_listing_claim", { p_claim: id, p_approve: approve });
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function moderateJobAction(
  id: string,
  status: "published" | "refused" | "closed",
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_posts")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function verifyArbiterAction(profileId: string, verified: boolean): Promise<Result> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arbiter_profiles")
    .update({ verified })
    .eq("profile_id", profileId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}
