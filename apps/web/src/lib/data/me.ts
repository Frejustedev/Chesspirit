import "server-only";
import type { SessionInfo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type GameFilters = {
  opponent?: string;
  color?: string;
  result?: string;
  eco?: string;
  tournament?: string;
  from?: string;
  to?: string;
};

/** Parties du joueur connecté, filtrables (adversaire, couleur, résultat, ECO, tournoi, période). */
export async function myGames(session: SessionInfo, f: GameFilters, limit = 200) {
  const me = session.profile!.id;
  const supabase = await createClient();
  let q = supabase
    .from("games")
    .select(
      "id, white_id, black_id, white_name, black_name, white_rating, black_rating, result, eco, opening, played_on, round_number, moves_count, tournament_id, tournaments(name, slug)",
    )
    .order("played_on", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (f.color === "w") q = q.eq("white_id", me);
  else if (f.color === "b") q = q.eq("black_id", me);
  else q = q.or(`white_id.eq.${me},black_id.eq.${me}`);
  if (f.eco && /^[A-E]\d{0,2}$/.test(f.eco)) q = q.ilike("eco", `${f.eco}%`);
  if (f.tournament && /^[0-9a-f-]{36}$/.test(f.tournament)) q = q.eq("tournament_id", f.tournament);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("played_on", f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte("played_on", f.to);
  const { data } = await q;
  const opp = (f.opponent ?? "").trim().toLowerCase();
  return (data ?? [])
    .map((g) => {
      const white = g.white_id === me;
      const score =
        g.result === "1/2-1/2"
          ? 0.5
          : (g.result === "1-0") === white
            ? 1
            : g.result === "*"
              ? null
              : 0;
      return {
        ...g,
        white,
        opponent: white ? g.black_name : g.white_name,
        opponentRating: white ? g.black_rating : g.white_rating,
        score,
      };
    })
    .filter((g) => !opp || g.opponent.toLowerCase().includes(opp))
    .filter(
      (g) =>
        !f.result ||
        (f.result === "win"
          ? g.score === 1
          : f.result === "draw"
            ? g.score === 0.5
            : g.score === 0),
    );
}
