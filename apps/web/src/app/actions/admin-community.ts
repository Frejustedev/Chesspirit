"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);
const i18n = z.object({ fr: z.string().trim().min(1).max(200), en: z.string().trim().max(200) });

function done(): Result {
  revalidatePath("/admin/communaute");
  revalidatePath("/communaute", "layout");
  return { ok: true };
}

/** Tarif premium : vide = « à confirmer » (aucune adhésion payante possible tant qu'il n'est pas fixé). */
export async function savePlanAction(raw: unknown): Promise<Result> {
  const p = z
    .object({
      code: z.enum(["free", "premium"]),
      price: z.number().int().min(0).max(10_000_000).nullable(),
      duration: z.number().int().min(1).max(36).nullable(),
      active: z.boolean(),
    })
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  if (p.data.code === "free" && p.data.price !== 0) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("membership_plans")
    .update({ price_xof: p.data.price, duration_months: p.data.duration, is_active: p.data.active })
    .eq("code", p.data.code);
  return error ? { ok: false, error: "forbidden" } : done();
}

export async function decideAmbassadorAction(profileId: string, approve: boolean): Promise<Result> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ambassadors")
    .update({ status: approve ? "approved" : "refused" })
    .eq("profile_id", profileId);
  if (error) return { ok: false, error: "forbidden" };
  await supabase.rpc("refresh_badges", { p_profile: profileId });
  return done();
}

const editionSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  slug,
  title: i18n,
  votingEndsAt: z.string().nullable(),
});

export async function createEditionAction(raw: unknown): Promise<Result> {
  const p = editionSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("award_editions").insert({
    year: p.data.year,
    slug: p.data.slug,
    title: p.data.title,
    voting_ends_at: p.data.votingEndsAt ? new Date(p.data.votingEndsAt).toISOString() : null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "slug_taken" : "forbidden" };
  return done();
}

export async function setEditionStatusAction(
  id: string,
  status: "draft" | "voting" | "closed",
): Promise<Result> {
  if (!uuid.safeParse(id).success || !["draft", "voting", "closed"].includes(status))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("award_editions").update({ status }).eq("id", id);
  return error ? { ok: false, error: "forbidden" } : done();
}

export async function addCategoryAction(editionId: string, name: unknown): Promise<Result> {
  const n = i18n.safeParse(name);
  if (!uuid.safeParse(editionId).success || !n.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { count } = await supabase
    .from("award_categories")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId);
  const { error } = await supabase
    .from("award_categories")
    .insert({ edition_id: editionId, name: n.data, position: (count ?? 0) + 1 });
  return error ? { ok: false, error: "forbidden" } : done();
}

export async function addNomineeAction(raw: unknown): Promise<Result> {
  const p = z
    .object({
      categoryId: uuid,
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500),
    })
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("award_nominees").insert({
    category_id: p.data.categoryId,
    name: p.data.name,
    description: p.data.description || null,
  });
  return error ? { ok: false, error: "forbidden" } : done();
}

export async function deleteAwardItemAction(
  kind: "category" | "nominee",
  id: string,
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from(kind === "category" ? "award_categories" : "award_nominees")
    .delete()
    .eq("id", id);
  return error ? { ok: false, error: "forbidden" } : done();
}

export async function createPvmAction(raw: unknown): Promise<Result<{ slug: string }>> {
  const p = z
    .object({
      slug,
      title: i18n,
      masterName: z.string().trim().min(2).max(120),
      publicColor: z.enum(["w", "b"]),
      voteMinutes: z.number().int().min(5).max(10080),
    })
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("pvm_games").insert({
    slug: p.data.slug,
    title: p.data.title,
    master_name: p.data.masterName,
    public_color: p.data.publicColor,
    vote_minutes: p.data.voteMinutes,
    vote_ends_at:
      p.data.publicColor === "w"
        ? new Date(Date.now() + p.data.voteMinutes * 60_000).toISOString()
        : null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "slug_taken" : "forbidden" };
  done();
  return { ok: true, data: { slug: p.data.slug } };
}
