import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const DIVISIONS = ["l1", "l2", "amateur"] as const;
export const LEAGUE_CADENCES = ["classical", "rapid", "blitz"] as const;

export type LeagueRules = {
  promoted?: number;
  relegated?: number;
  playoff?: { upper_rank?: number; lower_rank?: number };
  sofia_rule?: boolean;
  max_unjustified_forfeits?: number;
  postpone_deadline_days?: number;
};

export const getSeasons = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .order("starts_on", { ascending: false });
  return data ?? [];
});

/** Saison demandée, sinon la saison active réelle, sinon la plus récente. */
export async function pickSeason(slug?: string) {
  const seasons = await getSeasons();
  return (
    seasons.find((s) => s.slug === slug) ??
    seasons.find((s) => !s.is_demo && s.status !== "closed") ??
    seasons[0] ??
    null
  );
}

export async function getSeasonLeagues(seasonId: string) {
  const supabase = await createClient();
  const [{ data: leagues }, { data: standings }, { data: members }] = await Promise.all([
    supabase.from("leagues").select("*").eq("season_id", seasonId),
    supabase
      .from("league_standings")
      .select("league_id, player_id, display_name, points, rank")
      .eq("rank", 1),
    supabase.from("public_league_members").select("league_id"),
  ]);
  return (leagues ?? []).map((l) => ({
    ...l,
    leader: (standings ?? []).find((s) => s.league_id === l.id) ?? null,
    membersCount: (members ?? []).filter((m) => m.league_id === l.id).length,
  }));
}

export function leagueName(division: string, cadence: string, t: (k: string) => string): string {
  return `${t(`division.${division}`)} · ${t(`cadence.${cadence}`)}`;
}
