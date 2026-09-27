"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { generateNextRound, recomputeStandings } from "@/lib/tournament-engine";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const RESULTS = ["1-0", "0-1", "1/2-1/2", "+-", "-+", "=-=", "0-0"] as const;

function done(tournamentId: string) {
  revalidatePath(`/admin/tournois/${tournamentId}`);
  revalidatePath("/", "layout");
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournamentId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabase
    .from("tournament_audit")
    .insert({ tournament_id: tournamentId, action, details: details as never });
}

export async function generateRoundAction(
  tournamentId: string,
  onlyCheckedIn: boolean,
): Promise<Result<{ round: number; engine: string; warning?: string }>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  try {
    const r = await generateNextRound(supabase, tournamentId, { onlyCheckedIn });
    done(tournamentId);
    return { ok: true, data: { round: r.roundNumber, engine: r.engine, warning: r.warning } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function publishRoundAction(roundId: string, publish: boolean): Promise<Result> {
  if (!uuid.safeParse(roundId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rounds")
    .update({
      published_at: publish ? new Date().toISOString() : null,
      status: publish ? "ongoing" : "paired",
    })
    .eq("id", roundId)
    .select("tournament_id, number")
    .single();
  if (error) return { ok: false, error: error.message };
  await audit(supabase, data.tournament_id, publish ? "publish_round" : "unpublish_round", {
    round: data.number,
  });
  done(data.tournament_id);
  return { ok: true };
}

export async function setResultAction(pairingId: string, result: string | null): Promise<Result> {
  if (
    !uuid.safeParse(pairingId).success ||
    (result !== null && !(RESULTS as readonly string[]).includes(result))
  )
    return { ok: false, error: "invalid" };
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pairings")
    .update({
      result: result as never,
      result_entered_by: session?.userId ?? null,
      result_entered_at: new Date().toISOString(),
    })
    .eq("id", pairingId)
    .select("tournament_id, round_id")
    .single();
  if (error) return { ok: false, error: error.message };
  // Ronde terminée quand toutes les parties ont un résultat.
  const { data: open } = await supabase
    .from("pairings")
    .select("id")
    .eq("round_id", data.round_id)
    .not("black_id", "is", null)
    .is("result", null);
  await supabase
    .from("rounds")
    .update({ status: open?.length ? "ongoing" : "finished" })
    .eq("id", data.round_id)
    .neq("status", "paired");
  await recomputeStandings(supabase, data.tournament_id);
  done(data.tournament_id);
  return { ok: true };
}

/** Modification manuelle d'un appariement (tracée dans le journal d'audit par déclencheur). */
export async function editPairingAction(
  pairingId: string,
  white: string,
  black: string | null,
): Promise<Result> {
  if (
    !uuid.safeParse(pairingId).success ||
    !uuid.safeParse(white).success ||
    (black && !uuid.safeParse(black).success)
  )
    return { ok: false, error: "invalid" };
  if (white === black) return { ok: false, error: "same_player" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pairings")
    .update({
      white_id: white,
      black_id: black,
      bye_type: black ? null : "full",
      is_manual: true,
      result: null,
    })
    .eq("id", pairingId)
    .select("tournament_id")
    .single();
  if (error) return { ok: false, error: error.message };
  await audit(supabase, data.tournament_id, "edit_pairing", { pairing: pairingId, white, black });
  done(data.tournament_id);
  return { ok: true };
}

export async function swapColorsAction(pairingId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("pairings")
    .select("white_id, black_id, tournament_id")
    .eq("id", pairingId)
    .single();
  if (!p?.black_id) return { ok: false, error: "invalid" };
  return editPairingAction(pairingId, p.black_id, p.white_id);
}

/** Supprime la dernière ronde (seulement si aucun résultat n'est saisi). */
export async function deleteLastRoundAction(roundId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, tournament_id, number")
    .eq("id", roundId)
    .single();
  if (!round) return { ok: false, error: "forbidden" };
  const { data: later } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", round.tournament_id)
    .gt("number", round.number);
  const { data: withResult } = await supabase
    .from("pairings")
    .select("id")
    .eq("round_id", roundId)
    .not("result", "is", null)
    .not("black_id", "is", null);
  if (later?.length || withResult?.length) return { ok: false, error: "round_has_results" };
  await supabase.from("pairings").delete().eq("round_id", roundId);
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) return { ok: false, error: error.message };
  await audit(supabase, round.tournament_id, "delete_round", { round: round.number });
  await recomputeStandings(supabase, round.tournament_id);
  done(round.tournament_id);
  return { ok: true };
}

/** Forfait général ou retour d'un joueur ; bye demandé pour une ronde. */
export async function setParticipationAction(
  registrationId: string,
  patch: { withdrawn?: boolean; byeRound?: number; byeKind?: "half" | "zero" | null },
): Promise<Result> {
  if (!uuid.safeParse(registrationId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select("tournament_id, bye_requests")
    .eq("id", registrationId)
    .single();
  if (!reg) return { ok: false, error: "forbidden" };
  const update: { withdrawn_at?: string | null; bye_requests?: Record<string, string> } = {};
  if (patch.withdrawn !== undefined)
    update.withdrawn_at = patch.withdrawn ? new Date().toISOString() : null;
  if (patch.byeRound) {
    const b = { ...((reg.bye_requests ?? {}) as Record<string, string>) };
    if (patch.byeKind) b[String(patch.byeRound)] = patch.byeKind;
    else delete b[String(patch.byeRound)];
    update.bye_requests = b;
  }
  const { error } = await supabase.from("registrations").update(update).eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  await audit(supabase, reg.tournament_id, "participation", {
    registration: registrationId,
    ...patch,
  });
  done(reg.tournament_id);
  return { ok: true };
}

/** Élimination directe : ajoute une partie de départage (blitz puis Armageddon) sur un match nul. */
export async function addTiebreakGameAction(pairingId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: p } = await supabase.from("pairings").select("*").eq("id", pairingId).single();
  if (!p?.black_id) return { ok: false, error: "invalid" };
  const { data: siblings } = await supabase
    .from("pairings")
    .select("stage")
    .eq("round_id", p.round_id)
    .eq("board", p.board);
  const stages = new Set((siblings ?? []).map((s) => s.stage));
  const stage = !stages.has("blitz") ? "blitz" : !stages.has("armageddon") ? "armageddon" : null;
  if (!stage) return { ok: false, error: "no_more_tiebreaks" };
  const { error } = await supabase.from("pairings").insert({
    tournament_id: p.tournament_id,
    round_id: p.round_id,
    board: p.board,
    white_id: p.black_id,
    black_id: p.white_id,
    stage,
  });
  if (error) return { ok: false, error: error.message };
  done(p.tournament_id);
  return { ok: true };
}

/** Clôture : classement final publié, tournoi terminé. */
export async function closeTournamentAction(tournamentId: string): Promise<Result<number>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: open } = await supabase
    .from("pairings")
    .select("id")
    .eq("tournament_id", tournamentId)
    .not("black_id", "is", null)
    .is("result", null);
  if (open?.length) return { ok: false, error: "results_missing" };
  try {
    const n = await recomputeStandings(supabase, tournamentId, true);
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "finished", results_published: true })
      .eq("id", tournamentId);
    if (error) return { ok: false, error: error.message };
    await audit(supabase, tournamentId, "close_tournament", { players: n });
    done(tournamentId);
    return { ok: true, data: n };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
