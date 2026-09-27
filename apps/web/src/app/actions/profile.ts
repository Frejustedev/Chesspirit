"use server";

import { consentsSchema, profileSchema, childSchema } from "@chesspirit/shared";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export type ActionResult =
  { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

export async function saveProfile(input: unknown, consents: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "auth_required" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  if (!session.profile?.onboarded) {
    const c = consentsSchema.safeParse(consents);
    if (!c.success) return { ok: false, error: "invalid", fields: fieldErrors(c.error.issues) };
    const { error } = await supabase.rpc("complete_onboarding", {
      p_profile: parsed.data,
      p_consents: c.data,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("profiles")
      .update({
        ...parsed.data,
        club_name: parsed.data.club_name || null,
        fide_id: parsed.data.fide_id || null,
      })
      .eq("id", session.profile.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addChild(input: unknown, imageRights: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "profile_required" };
  const parsed = childSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_child", {
    p_profile: parsed.data,
    p_image_rights: imageRights,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/famille");
  return { ok: true };
}

export async function requestDeletion(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "profile_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("data_requests")
    .insert({ profile_id: session.profile.id, type: "delete" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/donnees");
  return { ok: true };
}

export async function setConsent(
  type: "newsletter" | "public_profile" | "image_rights",
  granted: boolean,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "profile_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("consents")
    .insert({ profile_id: session.profile.id, type, version: "2026-09", granted });
  if (error) return { ok: false, error: error.message };
  if (type === "public_profile") {
    await supabase
      .from("profiles")
      .update({ is_public: granted && !session.profile.is_minor })
      .eq("id", session.profile.id);
  }
  revalidatePath("/compte/donnees");
  return { ok: true };
}
