import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type SessionInfo = {
  userId: string;
  email: string | null;
  phone: string | null;
  aal: "aal1" | "aal2";
  profile: Tables<"profiles"> | null;
  roles: string[];
};

const ADMIN_ROLES = ["admin", "super_admin", "admin_competitions", "admin_shop", "moderator"];

/** Session courante (mise en cache pour la durée de la requête). */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roles }, { data: aal }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).is("merged_into", null).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return {
    userId: user.id,
    email: user.email ?? null,
    phone: user.phone ? `+${user.phone.replace(/^\+/, "")}` : null,
    aal: aal?.currentLevel === "aal2" ? "aal2" : "aal1",
    profile: profile ?? null,
    roles: (roles ?? []).map((r) => r.role),
  };
});

export function isAdminRole(roles: string[]) {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}
