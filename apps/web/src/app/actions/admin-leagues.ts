"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LEAGUE_TEMPLATE, STAGE_COEFFICIENTS } from "@/lib/leagues/template";
import type { Json } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done() {
  revalidatePath("/admin/ligues");
  revalidatePath("/competitions", "layout");
  revalidatePath("/classements", "layout");
}

const seasonSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(40),
  name: z.string().trim().min(3).max(80),
  startsOn: date,
  endsOn: date,
});

/** Nouvelle saison avec ses 9 championnats (modèle du dossier). */
export async function createSeasonAction(raw: unknown): Promise<Result<{ slug: string }>> {
  const p = seasonSchema.safeParse(raw);
  if (!p.success || p.data.endsOn <= p.data.startsOn) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: season, error } = await supabase
    .from("seasons")
    .insert({
      slug: p.data.slug,
      name: p.data.name,
      starts_on: p.data.startsOn,
      ends_on: p.data.endsOn,
    })
    .select("id, slug")
    .single();
  if (error || !season)
    return { ok: false, error: error?.code === "23505" ? "slug_taken" : "forbidden" };
  const { error: e2 } = await supabase.from("leagues").insert(
    LEAGUE_TEMPLATE.map(({ slugSuffix, ...l }) => ({
      ...l,
      season_id: season.id,
      slug: `${season.slug}-${slugSuffix}`,
    })),
  );
  if (e2) return { ok: false, error: "server" };
  done();
  return { ok: true, data: { slug: season.slug } };
}

const settingsSchema = z.object({
  id: uuid,
  status: z.enum(["planned", "active", "closed"]),
  licenseFee: z.number().int().min(0).max(10_000_000).nullable(),
  bestResults: z.number().int().min(1).max(20),
  mastersQualified: z.number().int().min(0).max(64),
  mastersInvited: z.number().int().min(0).max(64),
  rules: z.string().max(4000),
});

export async function saveSeasonAction(raw: unknown): Promise<Result> {
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  let rules: Json;
  try {
    rules = JSON.parse(p.data.rules) as Json;
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new Error();
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .update({
      status: p.data.status,
      license_fee_xof: p.data.licenseFee,
      tour_best_results: p.data.bestResults,
      masters_qualified: p.data.mastersQualified,
      masters_invited: p.data.mastersInvited,
      league_rules: rules,
    })
    .eq("id", p.data.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function allocateAction(seasonId: string): Promise<Result<number>> {
  if (!uuid.safeParse(seasonId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("allocate_season_by_rating", { p_season: seasonId });
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true, data: data ?? 0 };
}

/** Ajout d'un membre par téléphone (format international) ou identifiant de profil. */
export async function addMemberAction(leagueId: string, identifier: string): Promise<Result> {
  if (!uuid.safeParse(leagueId).success) return { ok: false, error: "invalid" };
  const id = identifier.trim();
  const supabase = await createClient();
  const q = supabase.from("profiles").select("id").is("merged_into", null).limit(1);
  const { data: p } = uuid.safeParse(id).success
    ? await q.eq("id", id).maybeSingle()
    : /^\+\d{8,15}$/.test(id.replace(/\s/g, ""))
      ? await q.eq("phone", id.replace(/\s/g, "")).maybeSingle()
      : { data: null };
  if (!p) return { ok: false, error: "profile_not_found" };
  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);
  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: leagueId, profile_id: p.id, seed: (count ?? 0) + 1 });
  if (error) return { ok: false, error: error.code === "23505" ? "already_member" : "forbidden" };
  done();
  return { ok: true };
}

export async function setMemberStatusAction(
  leagueId: string,
  profileId: string,
  status: "active" | "withdrawn" | "excluded" | "remove",
): Promise<Result> {
  if (!uuid.safeParse(leagueId).success || !uuid.safeParse(profileId).success)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const base =
    status === "remove"
      ? supabase.from("league_members").delete()
      : supabase.from("league_members").update({ status });
  const { data, error } = await base
    .eq("league_id", leagueId)
    .eq("profile_id", profileId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function createMatchdayAction(
  leagueId: string,
  on?: string,
): Promise<Result<{ tournamentId: string }>> {
  if (!uuid.safeParse(leagueId).success || (on && !date.safeParse(on).success))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_league_matchday", {
    p_league: leagueId,
    p_date: on || undefined,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "forbidden" };
  done();
  return { ok: true, data: { tournamentId: data } };
}

export async function refreshForfeitsAction(leagueId: string): Promise<Result<number>> {
  if (!uuid.safeParse(leagueId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refresh_league_forfeits", { p_league: leagueId });
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true, data: data ?? 0 };
}

export async function closeLeagueAction(leagueId: string): Promise<Result> {
  if (!uuid.safeParse(leagueId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_league", { p_league: leagueId });
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

const stageSchema = z.object({
  seasonId: uuid,
  name: z.string().trim().min(3).max(120),
  city: z.string().trim().max(80).optional(),
  plannedOn: date.optional().or(z.literal("").transform(() => undefined)),
  kind: z.enum(["regular", "major", "online", "masters"]),
  tournamentId: uuid.optional().or(z.literal("").transform(() => undefined)),
});

export async function addStageAction(raw: unknown): Promise<Result> {
  const p = stageSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { count } = await supabase
    .from("tour_stages")
    .select("id", { count: "exact", head: true })
    .eq("season_id", p.data.seasonId);
  const { error } = await supabase.from("tour_stages").insert({
    season_id: p.data.seasonId,
    number: (count ?? 0) + 1,
    name: p.data.name,
    city: p.data.city || null,
    planned_on: p.data.plannedOn ?? null,
    kind: p.data.kind,
    coefficient: STAGE_COEFFICIENTS[p.data.kind],
    tournament_id: p.data.tournamentId ?? null,
  });
  if (error)
    return { ok: false, error: error.code === "23505" ? "tournament_already_stage" : "forbidden" };
  done();
  return { ok: true };
}

export async function updateStageAction(
  id: string,
  patch: { tournamentId?: string | null; coefficient?: number; kind?: string },
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const update: { tournament_id?: string | null; coefficient?: number; kind?: string } = {};
  if (patch.tournamentId !== undefined) {
    if (patch.tournamentId && !uuid.safeParse(patch.tournamentId).success)
      return { ok: false, error: "invalid" };
    update.tournament_id = patch.tournamentId || null;
  }
  if (patch.coefficient !== undefined) {
    if (!(patch.coefficient >= 0 && patch.coefficient <= 3)) return { ok: false, error: "invalid" };
    update.coefficient = patch.coefficient;
  }
  if (patch.kind !== undefined) {
    if (!["regular", "major", "online", "masters"].includes(patch.kind))
      return { ok: false, error: "invalid" };
    update.kind = patch.kind;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_stages")
    .update(update)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

export async function computeStageAction(tournamentId: string): Promise<Result<number>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_tour_points", { p_tournament: tournamentId });
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true, data: data ?? 0 };
}

export async function toggleMastersInviteAction(
  seasonId: string,
  profileId: string,
  invite: boolean,
): Promise<Result> {
  if (!uuid.safeParse(seasonId).success || !uuid.safeParse(profileId).success)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = invite
    ? await supabase
        .from("masters_invitations")
        .insert({ season_id: seasonId, profile_id: profileId })
    : await supabase
        .from("masters_invitations")
        .delete()
        .eq("season_id", seasonId)
        .eq("profile_id", profileId);
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}
