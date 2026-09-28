import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Adhésion en cours d'un profil (la plus récente active et non expirée), lue avec les droits de l'utilisateur. */
export async function activeMemberships(profileId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Accès premium : adhésion premium active et non expirée (contrôle identique aux règles d'accès de la base). */
export async function hasPremium(profileId: string | null): Promise<boolean> {
  if (!profileId) return false;
  return (await activeMemberships(profileId)).some((m) => m.plan === "premium");
}
