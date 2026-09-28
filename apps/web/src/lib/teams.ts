import "server-only";
import {
  boardColors,
  pairTeamsSwiss,
  teamStandings,
  type ResultCode,
  type TeamMatchInput,
  type TeamScoring,
} from "@chesspirit/shared";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/** État complet d'un tournoi par équipes (lecture sous RLS : staff du tournoi). */
export async function loadTeamState(supabase: Db, tournamentId: string) {
  const [{ data: t }, { data: teams }, { data: matches }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, rounds_count, team_scoring, team_size, conditions")
      .eq("id", tournamentId)
      .single(),
    supabase
      .from("teams")
      .select(
        "id, name, seed, captain_id, team_members(id, profile_id, board_order, is_substitute, profiles(first_name, last_name, sex, birth_date))",
      )
      .eq("tournament_id", tournamentId)
      .order("seed"),
    supabase
      .from("team_matches")
      .select(
        "id, round_number, table_number, home_team_id, away_team_id, published, board_results(id, board, white_id, black_id, home_is_white, result)",
      )
      .eq("tournament_id", tournamentId)
      .order("round_number")
      .order("table_number"),
  ]);
  const inputs: TeamMatchInput[] = (matches ?? []).map((m) => ({
    round: m.round_number,
    home: m.home_team_id,
    away: m.away_team_id,
    boards: [...m.board_results]
      .sort((a, b) => a.board - b.board)
      .map((b) => ({ homeIsWhite: b.home_is_white, result: b.result as ResultCode | null })),
  }));
  const scoring = (t?.team_scoring ?? "match_points") as TeamScoring;
  const size = t?.team_size ?? 4;
  const standings = teamStandings(
    (teams ?? []).map((x) => ({ id: x.id, seed: x.seed })),
    inputs,
    scoring,
    size,
  );
  return { tournament: t, teams: teams ?? [], matches: matches ?? [], inputs, standings, size };
}

/**
 * Ronde suivante : appariement suisse des équipes, puis échiquiers dans l'ordre des compositions
 * (titulaires), Blancs à l'équipe citée en premier aux échiquiers impairs.
 */
export async function generateTeamRound(supabase: Db, tournamentId: string) {
  const st = await loadTeamState(supabase, tournamentId);
  if (st.teams.length < 2) throw new Error("not_enough_teams");
  const last = Math.max(0, ...st.matches.map((m) => m.round_number));
  if (last > 0) {
    const open = st.inputs.filter(
      (m) => m.round === last && m.away && m.boards.some((b) => !b.result),
    );
    if (open.length) throw new Error("round_not_finished");
  }
  if (st.tournament?.rounds_count && last >= st.tournament.rounds_count)
    throw new Error("all_rounds_done");
  const round = last + 1;
  const pairs = pairTeamsSwiss(
    st.standings.map((s) => s.teamId),
    st.matches.map((m) => ({ home: m.home_team_id, away: m.away_team_id })),
  );
  const lineup = (teamId: string) =>
    [...(st.teams.find((x) => x.id === teamId)?.team_members ?? [])]
      .filter((m) => !m.is_substitute)
      .sort((a, b) => a.board_order - b.board_order)
      .slice(0, st.size)
      .map((m) => m.profile_id);
  const colors = boardColors(st.size);
  let table = 0;
  for (const p of [...pairs].sort((a, b) => Number(!a.away) - Number(!b.away))) {
    table += 1;
    const { data: m, error } = await supabase
      .from("team_matches")
      .insert({
        tournament_id: tournamentId,
        round_number: round,
        table_number: table,
        home_team_id: p.home,
        away_team_id: p.away,
      })
      .select("id")
      .single();
    if (error || !m) throw new Error(error?.message ?? "insert_failed");
    if (!p.away) continue;
    const home = lineup(p.home);
    const away = lineup(p.away);
    const rows = colors.map((homeIsWhite, i) => ({
      team_match_id: m.id,
      board: i + 1,
      home_is_white: homeIsWhite,
      white_id: (homeIsWhite ? home[i] : away[i]) ?? null,
      black_id: (homeIsWhite ? away[i] : home[i]) ?? null,
    }));
    const { error: e2 } = await supabase.from("board_results").insert(rows);
    if (e2) throw new Error(e2.message);
  }
  return round;
}
