import "server-only";
import {
  bergerTables,
  computeStandings,
  firstRound,
  pairSwissFallback,
  type ByeKind,
  type PairingInput,
  type ResultCode,
  type SwissState,
  type Tiebreak,
  TIEBREAKS,
} from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

type DB = Awaited<ReturnType<typeof createClient>>;

export type Participant = {
  registrationId: string;
  playerId: string;
  startNo: number;
  name: string;
  trfName: string;
  rating: number;
  checkedIn: boolean;
  withdrawn: boolean;
  byeRequests: Record<string, "half" | "zero">;
};

export type EngineState = {
  tournament: Tables<"tournaments">;
  participants: Participant[];
  rounds: Tables<"rounds">[];
  pairings: Tables<"pairings">[];
};

export async function loadState(supabase: DB, tournamentId: string): Promise<EngineState> {
  const [{ data: tournament }, { data: regs }, { data: rounds }, { data: pairings }] =
    await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase
        .from("registrations")
        .select(
          "id, player_id, start_number, seed_rating, checked_in_at, withdrawn_at, bye_requests, status, profiles!registrations_player_id_fkey(first_name, last_name)",
        )
        .eq("tournament_id", tournamentId)
        .eq("status", "confirmed"),
      supabase.from("rounds").select("*").eq("tournament_id", tournamentId).order("number"),
      supabase.from("pairings").select("*").eq("tournament_id", tournamentId).order("board"),
    ]);
  if (!tournament) throw new Error("tournament_not_found");
  const participants = (regs ?? [])
    .filter((r) => r.start_number != null)
    .map((r) => ({
      registrationId: r.id,
      playerId: r.player_id,
      startNo: r.start_number!,
      name: `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim(),
      trfName: `${r.profiles?.last_name ?? ""}, ${r.profiles?.first_name ?? ""}`.slice(0, 33),
      rating: r.seed_rating ?? 0,
      checkedIn: !!r.checked_in_at,
      withdrawn: !!r.withdrawn_at,
      byeRequests: (r.bye_requests ?? {}) as Record<string, "half" | "zero">,
    }))
    .sort((a, b) => a.startNo - b.startNo);
  return { tournament, participants, rounds: rounds ?? [], pairings: pairings ?? [] };
}

const POINTS: Record<string, [number, number]> = {
  "1-0": [1, 0],
  "0-1": [0, 1],
  "1/2-1/2": [0.5, 0.5],
  "+-": [1, 0],
  "-+": [0, 1],
  "=-=": [0.5, 0.5],
  "0-0": [0, 0],
};
const BYE_POINTS: Record<string, number> = { full: 1, half: 0.5, zero: 0 };

/** Historique par joueur (rondes terminées ou en cours avec résultat). */
function history(state: EngineState) {
  const roundNo = new Map(state.rounds.map((r) => [r.id, r.number]));
  const start = new Map(state.participants.map((p) => [p.playerId, p.startNo]));
  const h = new Map<
    string,
    {
      round: number;
      opponent: string | null;
      color: "w" | "b" | "-";
      code: string;
      points: number;
    }[]
  >();
  for (const p of state.participants) h.set(p.playerId, []);
  for (const pr of state.pairings) {
    if (pr.stage !== "main") continue;
    const r = roundNo.get(pr.round_id)!;
    if (!pr.black_id) {
      const kind = pr.bye_type ?? "full";
      h.get(pr.white_id)?.push({
        round: r,
        opponent: null,
        color: "-",
        code: kind === "full" ? "U" : kind === "half" ? "H" : "Z",
        points: BYE_POINTS[kind]!,
      });
      continue;
    }
    if (!pr.result) continue;
    const [pw, pb] = POINTS[pr.result]!;
    const played = ["1-0", "0-1", "1/2-1/2"].includes(pr.result);
    const code = (x: number) =>
      played ? (x === 1 ? "1" : x === 0 ? "0" : "=") : x === 1 ? "+" : "-";
    h.get(pr.white_id)?.push({
      round: r,
      opponent: pr.black_id,
      color: "w",
      code: code(pw),
      points: pw,
    });
    h.get(pr.black_id)?.push({
      round: r,
      opponent: pr.white_id,
      color: "b",
      code: code(pb),
      points: pb,
    });
  }
  return { h, start };
}

export type GenerateResult = { roundNumber: number; engine: string; warning?: string };

/** Génère la ronde suivante selon le système du tournoi (appariements non publiés). */
export async function generateNextRound(
  supabase: DB,
  tournamentId: string,
  opts: { onlyCheckedIn: boolean },
): Promise<GenerateResult> {
  let state = await loadState(supabase, tournamentId);
  const t = state.tournament;
  const last = state.rounds.at(-1);
  if (last) {
    const unfinished = state.pairings.some(
      (p) => p.round_id === last.id && p.black_id && !p.result,
    );
    if (unfinished) throw new Error("previous_round_unfinished");
  }
  if (!state.participants.length || state.participants.some((p) => p.startNo == null)) {
    await supabase.rpc("assign_start_numbers", {
      p_tournament_id: tournamentId,
      p_only_checked_in: opts.onlyCheckedIn,
    });
    state = await loadState(supabase, tournamentId);
  } else {
    // Retardataires : numéros attribués à la suite.
    await supabase.rpc("assign_start_numbers", {
      p_tournament_id: tournamentId,
      p_only_checked_in: opts.onlyCheckedIn,
    });
    state = await loadState(supabase, tournamentId);
  }
  const roundNumber = (last?.number ?? 0) + 1;
  if (t.rounds_count && roundNumber > t.rounds_count && !["knockout"].includes(t.pairing_system))
    throw new Error("all_rounds_generated");
  const active = state.participants.filter(
    (p) => !p.withdrawn && (!opts.onlyCheckedIn || p.checkedIn),
  );
  if (active.length < 2) throw new Error("not_enough_players");

  let engine = "manual";
  let warning: string | undefined;
  let pairs: { white: string; black: string | null; bye?: ByeKind }[] = [];

  if (t.pairing_system === "round_robin" || t.pairing_system === "double_round_robin") {
    const double = t.pairing_system === "double_round_robin";
    const order = [...active].sort((a, b) => a.startNo - b.startNo);
    const table = bergerTables(order.length, double).filter((p) => p.round === roundNumber);
    if (!table.length) throw new Error("all_rounds_generated");
    pairs = table.map((p) =>
      p.white === 0
        ? { white: order[p.black - 1]!.playerId, black: null, bye: "zero" as const }
        : p.black === 0
          ? { white: order[p.white - 1]!.playerId, black: null, bye: "zero" as const }
          : { white: order[p.white - 1]!.playerId, black: order[p.black - 1]!.playerId },
    );
    engine = "round_robin";
  } else if (t.pairing_system === "knockout") {
    pairs = knockoutPairs(state, active, roundNumber);
    engine = "knockout";
  } else if (t.pairing_system === "swiss_dutch" || t.pairing_system === "swiss_accelerated") {
    const { h } = history(state);
    const requested = new Map(
      active
        .filter((p) => p.byeRequests[String(roundNumber)])
        .map((p) => [p.playerId, p.byeRequests[String(roundNumber)]!]),
    );
    const toPair = active.filter((p) => !requested.has(p.playerId));
    for (const [pid, kind] of requested) pairs.push({ white: pid, black: null, bye: kind });
    const viaEngine = await pairWithEngine(state, toPair, roundNumber, h).catch((e: Error) => {
      warning = e.message;
      return null;
    });
    if (viaEngine) {
      pairs.push(...viaEngine);
      engine = "bbp";
    } else {
      const states: SwissState[] = toPair.map((p) => {
        const rows = h.get(p.playerId) ?? [];
        return {
          id: p.playerId,
          startNo: p.startNo,
          rating: p.rating,
          points: rows.reduce((a, r) => a + r.points, 0),
          opponents: rows.filter((r) => r.opponent).map((r) => r.opponent!),
          colors: rows
            .filter((r) => r.color !== "-" && ["1", "0", "="].includes(r.code))
            .map((r) => r.color as "w" | "b"),
          hadBye: rows.some((r) => r.code === "U"),
        };
      });
      pairs.push(
        ...pairSwissFallback(states, roundNumber).map((p) => ({
          ...p,
          bye: p.black ? undefined : ((t.bye_points === 0.5 ? "half" : "full") as ByeKind),
        })),
      );
      engine = "fallback";
    }
  } else {
    throw new Error("system_not_supported");
  }

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({
      tournament_id: tournamentId,
      number: roundNumber,
      status: "paired",
      pairing_engine: engine as never,
    })
    .select("id")
    .single();
  if (error || !round) throw new Error(error?.message ?? "round_insert_failed");
  const games = pairs.filter((p) => p.black);
  const byes = pairs.filter((p) => !p.black);
  const rows = [
    ...games.map((p, i) => ({
      tournament_id: tournamentId,
      round_id: round.id,
      board: i + 1,
      white_id: p.white,
      black_id: p.black,
    })),
    ...byes.map((p) => ({
      tournament_id: tournamentId,
      round_id: round.id,
      board: 0,
      white_id: p.white,
      black_id: null,
      bye_type: p.bye ?? "full",
    })),
  ];
  const { error: pe } = await supabase.from("pairings").insert(rows);
  if (pe) throw new Error(pe.message);
  await supabase
    .from("tournaments")
    .update({ status: "ongoing" })
    .eq("id", tournamentId)
    .in("status", ["registration_open", "registration_closed", "published"]);
  await supabase
    .from("tournament_audit")
    .insert({
      tournament_id: tournamentId,
      action: "generate_round",
      details: { round: roundNumber, engine, warning: warning ?? null },
    });
  return { roundNumber, engine, warning };
}

async function pairWithEngine(
  state: EngineState,
  players: Participant[],
  round: number,
  h: ReturnType<typeof history>["h"],
) {
  const url = process.env.CHESS_ENGINE_URL;
  const key = process.env.CHESS_ENGINE_KEY;
  if (!url || !key) throw new Error("engine_not_configured");
  const start = new Map(state.participants.map((p) => [p.playerId, p.startNo]));
  const active = new Set(players.map((p) => p.playerId));
  const body = {
    total_rounds: state.tournament.rounds_count ?? Math.max(round, 5),
    round,
    initial_color: state.tournament.initial_color,
    players: state.participants.map((p) => {
      const rows = h.get(p.playerId) ?? [];
      return {
        start_no: p.startNo,
        name: p.trfName,
        rating: p.rating || null,
        points: rows.reduce((a, r) => a + r.points, 0),
        history: rows.map((r) => ({
          round: r.round,
          opponent: r.opponent ? start.get(r.opponent) : null,
          color: r.color,
          result: r.code,
        })),
        absent: !active.has(p.playerId),
      };
    }),
  };
  const res = await fetch(`${url}/pairings/swiss`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-engine-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`engine_error_${res.status}`);
  const pairs = (await res.json()) as { white: number; black: number | null }[];
  const byStart = new Map(state.participants.map((p) => [p.startNo, p.playerId]));
  return pairs.map((p) => ({
    white: byStart.get(p.white)!,
    black: p.black ? byStart.get(p.black)! : null,
    bye: p.black ? undefined : ((state.tournament.bye_points === 0.5 ? "half" : "full") as ByeKind),
  }));
}

/** Élimination directe : tableau par têtes de série, puis vainqueurs (départages blitz/Armageddon saisis par l'arbitre). */
function knockoutPairs(state: EngineState, active: Participant[], round: number) {
  if (round === 1) {
    const seeds = [...active].sort((a, b) => b.rating - a.rating || a.startNo - b.startNo);
    return firstRound(seeds.length).map((m) => {
      const a = m.a ? seeds[m.a - 1]!.playerId : null;
      const b = m.b ? seeds[m.b - 1]!.playerId : null;
      return a && b
        ? { white: a, black: b }
        : { white: (a ?? b)!, black: null, bye: "full" as ByeKind };
    });
  }
  const prev = state.rounds.find((r) => r.number === round - 1)!;
  const winners = matchWinners(state.pairings.filter((p) => p.round_id === prev.id));
  if (winners.includes(null)) throw new Error("knockout_undecided");
  if (winners.length < 2) throw new Error("all_rounds_generated");
  const out = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i]!;
    const b = winners[i + 1];
    out.push(b ? { white: a, black: b } : { white: a, black: null, bye: "full" as ByeKind });
  }
  return out;
}

/** Vainqueur de chaque match (partie principale, puis blitz, puis Armageddon où la nulle qualifie les Noirs). */
export function matchWinners(pairings: Tables<"pairings">[]): (string | null)[] {
  const byBoard = new Map<number, Tables<"pairings">[]>();
  for (const p of pairings) byBoard.set(p.board, [...(byBoard.get(p.board) ?? []), p]);
  return [...byBoard.entries()]
    .sort(([a], [b]) => (a === 0 ? 1e9 : a) - (b === 0 ? 1e9 : b))
    .map(([, games]) => {
      const main = games.find((g) => g.stage === "main")!;
      if (!main.black_id) return main.white_id;
      const decide = (g: Tables<"pairings"> | undefined, armageddon = false): string | null => {
        if (!g?.result) return null;
        const [w, b] = POINTS[g.result]!;
        if (w > b) return g.white_id;
        if (b > w) return g.black_id;
        return armageddon ? g.black_id : null;
      };
      return (
        decide(main) ??
        decide(games.find((g) => g.stage === "blitz")) ??
        decide(
          games.find((g) => g.stage === "armageddon"),
          true,
        )
      );
    });
}

/** Recalcule et enregistre le classement provisoire (ou final). */
export async function recomputeStandings(supabase: DB, tournamentId: string, final = false) {
  const state = await loadState(supabase, tournamentId);
  const roundNo = new Map(state.rounds.map((r) => [r.id, r.number]));
  const inputs: PairingInput[] = state.pairings
    .filter((p) => p.stage === "main")
    .map((p) => ({
      round: roundNo.get(p.round_id)!,
      white: p.white_id,
      black: p.black_id,
      result: (p.result as ResultCode | null) ?? null,
      byeKind: (p.bye_type as ByeKind | null) ?? undefined,
    }));
  const order = state.tournament.tiebreaks.filter((x): x is Tiebreak =>
    (TIEBREAKS as readonly string[]).includes(x),
  );
  const rows = computeStandings(
    state.participants.map((p) => ({ id: p.playerId, name: p.name, rating: p.rating || null })),
    inputs,
    order,
  );
  await supabase.from("standings").delete().eq("tournament_id", tournamentId);
  if (rows.length) {
    const { error } = await supabase.from("standings").insert(
      rows.map((s) => ({
        tournament_id: tournamentId,
        player_id: s.playerId,
        rank: s.rank,
        points: s.points,
        games: s.games,
        tiebreaks: s.tiebreaks,
        performance: s.tiebreaks.performance || null,
        rating_before: s.rating,
        is_final: final,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return rows.length;
}
