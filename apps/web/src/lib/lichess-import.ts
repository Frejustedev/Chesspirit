import "server-only";
import { parsePgn } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexGames } from "@/lib/positions";
import type { createClient } from "@/lib/supabase/server";
import { fetchGamesPgn, fetchResults, lichessFake, type LichessResult } from "@/lib/lichess";

type Db = Awaited<ReturnType<typeof createClient>>;
type Result = "1-0" | "0-1" | "1/2-1/2";

/**
 * Importe le classement et les parties d'un tournoi Lichess. Les joueurs sont reconnus par
 * leur compte Lichess lié ; les inconnus sont listés sans être créés. Les parties entre deux
 * joueurs reconnus alimentent la cote en ligne (appariements d'une ronde unique).
 * Écritures sous RLS : il faut pouvoir arbitrer le tournoi.
 */
export async function importLichessTournament(supabase: Db, tournamentId: string) {
  const { data: t } = await supabase
    .from("tournaments")
    .update({ lichess_imported_at: new Date().toISOString() })
    .eq("id", tournamentId)
    .select("id, name, lichess_kind, lichess_id, starts_at")
    .single();
  if (!t) throw new Error("forbidden");
  if (!t.lichess_kind || !t.lichess_id) throw new Error("lichess_id_missing");

  // Correspondance nom d'utilisateur → profil (lecture système, après contrôle des droits ci-dessus).
  const { data: accounts } = await createAdminClient()
    .from("lichess_accounts")
    .select("profile_id, username");
  const byUser = new Map((accounts ?? []).map((a) => [a.username.toLowerCase(), a.profile_id]));

  let results: LichessResult[];
  let games: {
    white: string;
    black: string;
    result: Result;
    pgn: string;
    headers: Record<string, string>;
  }[] = [];
  if (lichessFake()) {
    // Mode factice : classement et parties générés à partir des inscrits ayant lié un compte.
    const { data: regs } = await supabase
      .from("registrations")
      .select("player_id")
      .eq("tournament_id", tournamentId);
    const linked = (accounts ?? []).filter((a) => regs?.some((r) => r.player_id === a.profile_id));
    results = linked.map((a, i) => ({
      rank: i + 1,
      username: a.username,
      points: linked.length - i,
    }));
    for (let i = 0; i + 1 < linked.length; i += 2)
      games.push({
        white: linked[i]!.username,
        black: linked[i + 1]!.username,
        result: "1-0",
        pgn: `[Event "${t.name}"]\n[White "${linked[i]!.username}"]\n[Black "${linked[i + 1]!.username}"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`,
        headers: {},
      });
  } else {
    const kind = t.lichess_kind as "arena" | "swiss";
    results = await fetchResults(kind, t.lichess_id);
    const pgn = await fetchGamesPgn(kind, t.lichess_id).catch(() => "");
    games = parsePgn(pgn)
      .map((g) => ({
        white: g.headers.White ?? "",
        black: g.headers.Black ?? "",
        result: g.headers.Result as Result,
        pgn: g.raw,
        headers: g.headers,
      }))
      .filter((g) => ["1-0", "0-1", "1/2-1/2"].includes(g.result));
  }

  const matched = results.filter((r) => byUser.has(r.username.toLowerCase()));
  const unknown = results
    .filter((r) => !byUser.has(r.username.toLowerCase()))
    .map((r) => r.username);

  // Classement : rangs recalculés parmi les joueurs reconnus (ordre Lichess conservé).
  await supabase.from("standings").delete().eq("tournament_id", tournamentId);
  if (matched.length) {
    const { error } = await supabase.from("standings").insert(
      matched.map((r, i) => ({
        tournament_id: tournamentId,
        player_id: byUser.get(r.username.toLowerCase())!,
        rank: i + 1,
        points: r.points,
        tiebreaks: { lichess_rank: r.rank },
        rating_before: r.rating ?? null,
        is_final: true,
      })),
    );
    if (error) throw new Error(error.message);
  }

  // Parties : une ronde unique « en ligne », appariements pour la cote en ligne et archive PGN.
  const known = games.filter(
    (g) => byUser.has(g.white.toLowerCase()) && byUser.has(g.black.toLowerCase()),
  );
  await supabase.from("rounds").delete().eq("tournament_id", tournamentId);
  await supabase.from("games").delete().eq("tournament_id", tournamentId).eq("source", "lichess");
  if (known.length) {
    const { data: round, error: re } = await supabase
      .from("rounds")
      .insert({
        tournament_id: tournamentId,
        number: 1,
        status: "finished",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (re || !round) throw new Error(re?.message ?? "round_failed");
    const rows = known.map((g, i) => ({
      tournament_id: tournamentId,
      round_id: round.id,
      board: i + 1,
      white_id: byUser.get(g.white.toLowerCase())!,
      black_id: byUser.get(g.black.toLowerCase())!,
      result: g.result,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("pairings").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    const gameRows = known.map((g, i) => ({
      tournament_id: tournamentId,
      round_id: round.id,
      round_number: 1,
      board: i + 1,
      white_id: byUser.get(g.white.toLowerCase())!,
      black_id: byUser.get(g.black.toLowerCase())!,
      white_name: g.white,
      black_name: g.black,
      result: g.result,
      pgn: g.pgn.slice(0, 199_000),
      eco: /^[A-E]\d\d$/.test(g.headers.ECO ?? "") ? g.headers.ECO! : null,
      opening: g.headers.Opening ?? null,
      played_on: t.starts_at.slice(0, 10),
      source: "lichess" as const,
    }));
    const inserted: string[] = [];
    for (let i = 0; i < gameRows.length; i += 200) {
      const { data } = await supabase
        .from("games")
        .insert(gameRows.slice(i, i + 200))
        .select("id");
      inserted.push(...(data ?? []).map((g) => g.id));
    }
    await indexGames(inserted).catch(() => null);
  }
  return { players: matched.length, unknown, games: known.length };
}
