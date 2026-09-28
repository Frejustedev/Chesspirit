"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTeamRound } from "@/lib/teams";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const RESULTS = ["1-0", "0-1", "1/2-1/2", "+-", "-+", "=-=", "0-0"] as const;

function done(tournamentId?: string) {
  if (tournamentId) revalidatePath(`/admin/tournois/${tournamentId}`);
  revalidatePath("/competitions", "layout");
}

export async function createTeamAction(tournamentId: string, name: string): Promise<Result> {
  const n = name.trim();
  if (!uuid.safeParse(tournamentId).success || n.length < 2 || n.length > 80)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { count } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  const { error } = await supabase
    .from("teams")
    .insert({ tournament_id: tournamentId, name: n, seed: (count ?? 0) + 1 });
  if (error) return { ok: false, error: error.code === "23505" ? "team_exists" : "forbidden" };
  done(tournamentId);
  return { ok: true };
}

export async function deleteTeamAction(teamId: string): Promise<Result> {
  if (!uuid.safeParse(teamId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .select("tournament_id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done(data[0]!.tournament_id);
  return { ok: true };
}

/** Ajout d'un joueur inscrit au tournoi ; l'ordre des échiquiers suit la cote à l'inscription. */
export async function addTeamMemberAction(
  teamId: string,
  profileId: string,
  substitute: boolean,
): Promise<Result> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(profileId).success)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("id, tournament_id, team_members(board_order)")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "forbidden" };
  const next = Math.max(0, ...team.team_members.map((m) => m.board_order)) + 1;
  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    profile_id: profileId,
    board_order: next,
    is_substitute: substitute,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "already_member" : "forbidden" };
  done(team.tournament_id);
  return { ok: true };
}

export async function removeTeamMemberAction(memberId: string): Promise<Result> {
  if (!uuid.safeParse(memberId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("team_members").delete().eq("id", memberId);
  if (error) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

/** Ordre des échiquiers : titulaires par cote décroissante, remplaçants ensuite. */
export async function orderBoardsByRatingAction(teamId: string): Promise<Result> {
  if (!uuid.safeParse(teamId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("tournament_id, team_members(id, profile_id, is_substitute)")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "forbidden" };
  const { data: regs } = await supabase
    .from("registrations")
    .select("player_id, seed_rating")
    .eq("tournament_id", team.tournament_id);
  const rating = new Map((regs ?? []).map((r) => [r.player_id, r.seed_rating ?? 0]));
  const ordered = [...team.team_members].sort(
    (a, b) =>
      Number(a.is_substitute) - Number(b.is_substitute) ||
      (rating.get(b.profile_id) ?? 0) - (rating.get(a.profile_id) ?? 0),
  );
  // Deux passes pour respecter l'unicité (équipe, échiquier).
  for (const [i, m] of ordered.entries())
    await supabase
      .from("team_members")
      .update({ board_order: 100 + i })
      .eq("id", m.id);
  for (const [i, m] of ordered.entries())
    await supabase
      .from("team_members")
      .update({ board_order: i + 1 })
      .eq("id", m.id);
  done(team.tournament_id);
  return { ok: true };
}

export async function generateTeamRoundAction(tournamentId: string): Promise<Result<number>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  try {
    const round = await generateTeamRound(supabase, tournamentId);
    done(tournamentId);
    return { ok: true, data: round };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function publishTeamRoundAction(
  tournamentId: string,
  round: number,
  publish: boolean,
): Promise<Result> {
  if (!uuid.safeParse(tournamentId).success || !Number.isInteger(round))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_matches")
    .update({ published: publish })
    .eq("tournament_id", tournamentId)
    .eq("round_number", round)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done(tournamentId);
  return { ok: true };
}

export async function setBoardResultAction(
  boardId: string,
  result: string | null,
): Promise<Result> {
  if (
    !uuid.safeParse(boardId).success ||
    (result && !(RESULTS as readonly string[]).includes(result))
  )
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_results")
    .update({ result: result as (typeof RESULTS)[number] | null })
    .eq("id", boardId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}

/** Remplacement d'un joueur sur un échiquier (remplaçant ou changement d'ordre). */
export async function setBoardPlayerAction(
  boardId: string,
  side: "white" | "black",
  profileId: string | null,
): Promise<Result> {
  if (!uuid.safeParse(boardId).success || (profileId && !uuid.safeParse(profileId).success))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_results")
    .update(side === "white" ? { white_id: profileId } : { black_id: profileId })
    .eq("id", boardId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done();
  return { ok: true };
}
