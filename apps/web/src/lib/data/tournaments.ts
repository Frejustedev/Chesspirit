import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Tournament = Tables<"tournaments">;

const UPCOMING = ["published", "registration_open", "registration_closed", "ongoing"] as const;

/** Prochain événement public (bandeau d'accueil, bouton d'action de l'en-tête). */
export const getNextEvent = cache(async (): Promise<Tournament | null> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .in("status", [...UPCOMING])
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
});

export const getTournamentBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export async function getTournamentExtras(id: string) {
  const supabase = await createClient();
  const [partners, prizes, registrants, standings, form] = await Promise.all([
    supabase.from("tournament_partners").select("*").eq("tournament_id", id).order("position"),
    supabase.from("prizes").select("*").eq("tournament_id", id).order("position"),
    supabase
      .from("public_registrations")
      .select("*")
      .eq("tournament_id", id)
      .order("seed_rating", { ascending: false, nullsFirst: false })
      .order("display_name"),
    supabase.from("public_standings").select("*").eq("tournament_id", id).order("rank"),
    supabase.from("registration_forms").select("fields").eq("tournament_id", id).maybeSingle(),
  ]);
  return {
    partners: partners.data ?? [],
    prizes: prizes.data ?? [],
    registrants: registrants.data ?? [],
    standings: standings.data ?? [],
    formFields: (form.data?.fields ?? []) as unknown[],
  };
}

export async function listTournaments(opts: { past?: boolean; limit?: number } = {}) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let q = supabase.from("tournaments").select("*").neq("status", "draft");
  q = opts.past
    ? q.lt("starts_at", now).order("starts_at", { ascending: false })
    : q.gte("starts_at", new Date(Date.now() - 18 * 3600 * 1000).toISOString()).order("starts_at");
  const { data } = await q.limit(opts.limit ?? 50);
  return data ?? [];
}

export async function getLatestResults(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_standings")
    .select("tournament_id, rank, display_name, points")
    .lte("rank", 3)
    .limit(60);
  if (!data?.length) return [];
  const ids = [...new Set(data.map((d) => d.tournament_id!))];
  const { data: ts } = await supabase
    .from("tournaments")
    .select("id, name, slug, starts_at, is_demo")
    .in("id", ids)
    .order("starts_at", { ascending: false })
    .limit(limit);
  return (ts ?? []).map((t) => ({
    tournament: t,
    podium: data.filter((d) => d.tournament_id === t.id).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
  }));
}

/** Champs « À confirmer » : valeur absente ou explicitement listée. */
export function isTbc(t: Tournament, field: string, value: unknown) {
  return value === null || value === undefined || t.unconfirmed_fields.includes(field);
}
