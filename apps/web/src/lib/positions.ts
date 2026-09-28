import "server-only";
import { Chess } from "chess.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fenKey } from "@/lib/fen-key";

/**
 * Indexe les positions des parties non encore traitées (une ligne par demi-coup).
 * Une partie illisible est marquée traitée sans position, pour ne pas bloquer la file.
 */
export async function indexPendingGames(limit = 300) {
  const db = createAdminClient();
  const { data: games } = await db
    .from("games")
    .select("id, pgn")
    .is("positions_indexed_at", null)
    .order("created_at")
    .limit(limit);
  let indexed = 0;
  let unreadable = 0;
  for (const g of games ?? []) {
    const rows: { game_id: string; ply: number; fen_key: string; next_san: string | null }[] = [];
    try {
      const chess = new Chess();
      chess.loadPgn(g.pgn);
      const history = chess.history({ verbose: true });
      history.forEach((m, i) =>
        rows.push({ game_id: g.id, ply: i, fen_key: fenKey(m.before)!, next_san: m.san }),
      );
      if (history.length)
        rows.push({
          game_id: g.id,
          ply: history.length,
          fen_key: fenKey(history.at(-1)!.after)!,
          next_san: null,
        });
    } catch {
      unreadable++;
    }
    await db.from("game_positions").delete().eq("game_id", g.id);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("game_positions").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    await db
      .from("games")
      .update({ positions_indexed_at: new Date().toISOString() })
      .eq("id", g.id);
    if (rows.length) indexed++;
  }
  return { indexed, unreadable, remaining: (games?.length ?? 0) === limit };
}
