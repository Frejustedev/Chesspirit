import "server-only";
import { levelFor, xpFor } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";

/** Activité, badges et niveau d'un profil (le calcul des badges est rafraîchi à la demande). */
export async function memberStanding(profileId: string, refresh = false) {
  const supabase = await createClient();
  if (refresh) await supabase.rpc("refresh_badges", { p_profile: profileId });
  const [{ data: progress }, { data: badges }] = await Promise.all([
    supabase.rpc("member_progress", { p_profile: profileId }),
    supabase
      .from("user_badges")
      .select("badge_code, awarded_at, context, badges(name, description, icon, category)")
      .eq("profile_id", profileId)
      .order("awarded_at"),
  ]);
  const p = progress?.[0];
  const activity = {
    tournaments: Number(p?.tournaments ?? 0),
    games: Number(p?.games ?? 0),
    puzzles: Number(p?.puzzles ?? 0),
    lessons: Number(p?.lessons_booked ?? 0),
    predictions: Number(p?.predictions ?? 0),
    badges: badges?.length ?? 0,
  };
  return { activity, badges: badges ?? [], ...levelFor(xpFor(activity)) };
}
