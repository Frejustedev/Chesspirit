"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { recomputeAllRatings } from "@/lib/ratings";
import type { Database, Json } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
type Role = Database["public"]["Enums"]["app_role"];

function done() {
  revalidatePath("/admin", "layout");
}

/** Suspension : profil marqué et compte de connexion bloqué (API d'administration d'authentification). */
export async function setSuspendedAction(profileId: string, suspended: boolean): Promise<Result> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "invalid" };
  const session = await getSession();
  if (session?.profile?.id === profileId) return { ok: false, error: "self" };
  const supabase = await createClient();
  // La mise à jour sous RLS prouve le droit d'administration.
  const { data, error } = await supabase
    .from("profiles")
    .update({ suspended_at: suspended ? new Date().toISOString() : null })
    .eq("id", profileId)
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "forbidden" };
  if (data.user_id) {
    const { error: e } = await createAdminClient().auth.admin.updateUserById(data.user_id, {
      ban_duration: suspended ? "876000h" : "none",
    });
    if (e) return { ok: false, error: "auth_update_failed" };
  }
  done();
  return { ok: true };
}

const ROLES = [
  "player",
  "parent",
  "coach",
  "arbiter",
  "organizer",
  "editor",
  "partner",
  "admin_competitions",
  "admin_shop",
  "moderator",
  "admin",
  "super_admin",
] as const;

/** Attribution ou retrait d'un rôle (super-administrateur uniquement, vérifié par la RLS). */
export async function setRoleAction(userId: string, role: string, grant: boolean): Promise<Result> {
  if (!uuid.safeParse(userId).success || !(ROLES as readonly string[]).includes(role))
    return { ok: false, error: "invalid" };
  const session = await getSession();
  if (session?.userId === userId && role === "super_admin" && !grant)
    return { ok: false, error: "self" };
  const supabase = await createClient();
  const { data, error } = grant
    ? await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: role as Role, granted_by: session?.userId },
          { onConflict: "user_id,role,scope_id", ignoreDuplicates: true },
        )
        .select("id")
    : await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as Role)
        .is("scope_id", null)
        .select("id");
  if (error || (!grant && !data?.length)) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function mergeProfilesAction(keep: string, merge: string): Promise<Result<number>> {
  if (!uuid.safeParse(keep).success || !uuid.safeParse(merge).success)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_merge_profiles", {
    p_keep: keep,
    p_merge: merge,
  });
  if (error) return { ok: false, error: error.message };
  // Les cotes dépendent des identités : recalcul complet (idempotent).
  await recomputeAllRatings().catch(() => undefined);
  done();
  return { ok: true, data: data ?? 0 };
}

/** Droit à l'effacement : anonymisation du profil puis suppression du compte de connexion. */
export async function anonymizeProfileAction(
  profileId: string,
  requestId?: string,
): Promise<Result> {
  if (!uuid.safeParse(profileId).success || (requestId && !uuid.safeParse(requestId).success))
    return { ok: false, error: "invalid" };
  const session = await getSession();
  if (session?.profile?.id === profileId) return { ok: false, error: "self" };
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("admin_anonymize_profile", {
    p_profile: profileId,
  });
  if (error) return { ok: false, error: error.message };
  if (userId) await createAdminClient().auth.admin.deleteUser(userId);
  if (requestId)
    await supabase
      .from("data_requests")
      .update({
        status: "done",
        processed_by: session?.userId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  done();
  return { ok: true };
}

export async function setDataRequestStatusAction(
  id: string,
  status: "processing" | "done" | "refused",
): Promise<Result> {
  if (!uuid.safeParse(id).success || !["processing", "done", "refused"].includes(status))
    return { ok: false, error: "invalid" };
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .update({
      status,
      processed_by: session?.userId,
      processed_at: status === "processing" ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function setContactStatusAction(
  id: string,
  status: "new" | "answered" | "archived",
): Promise<Result> {
  if (!uuid.safeParse(id).success || !["new", "answered", "archived"].includes(status))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function setQuoteStatusAction(
  id: string,
  status: "new" | "in_progress" | "sent" | "won" | "lost",
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function refundAction(
  paymentId: string,
  amount: number,
  reason: string,
): Promise<Result> {
  if (!uuid.safeParse(paymentId).success || !Number.isInteger(amount) || amount < 1)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_refund", {
    p_payment: paymentId,
    p_amount: amount,
    p_reason: reason.slice(0, 500),
  });
  if (error) return { ok: false, error: error.message };
  done();
  return { ok: true };
}

/** Paramètre système (super-administrateur, vérifié par la RLS). La valeur est du JSON. */
export async function saveAppSettingAction(key: string, raw: string): Promise<Result> {
  if (!/^[a-z0-9_]{2,64}$/.test(key)) return { ok: false, error: "invalid" };
  let value: Json;
  try {
    value = JSON.parse(raw) as Json;
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", key)
    .select("key");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFeatureFlagAction(key: string, enabled: boolean): Promise<Result> {
  if (!/^[a-z0-9_]{2,64}$/.test(key)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .update({ enabled })
    .eq("key", key)
    .select("key");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Ouverture d'un pays de la sous-région (super-administration, comme les indicateurs). */
export async function setCountryEnabledAction(code: string, enabled: boolean): Promise<Result> {
  if (!/^[A-Z]{2}$/.test(code) || (code === "BJ" && !enabled))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("countries")
    .update({ enabled })
    .eq("code", code)
    .select("code");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}
