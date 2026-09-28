import "server-only";
import { Chess } from "chess.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fenKey } from "@/lib/fen-key";

type Db = ReturnType<typeof createAdminClient>;
type PositionRow = { game_id: string; ply: number; fen_key: string; next_san: string | null };

/** Une ligne par demi-coup : position avant le coup, et position finale (sans coup suivant). */
function positionsOf(game: { id: string; pgn: string }): PositionRow[] {
  const chess = new Chess();
  chess.loadPgn(game.pgn);
  const history = chess.history({ verbose: true });
  const rows: PositionRow[] = history.map((m, i) => ({
    game_id: game.id,
    ply: i,
    fen_key: fenKey(m.before)!,
    next_san: m.san,
  }));
  if (history.length)
    rows.push({
      game_id: game.id,
      ply: history.length,
      fen_key: fenKey(history.at(-1)!.after)!,
      next_san: null,
    });
  return rows;
}

/**
 * Indexe un lot de parties en quelques requêtes (suppression, insertion par paquets, marquage).
 * Une partie illisible est marquée traitée sans position, pour ne pas bloquer la file.
 */
async function indexBatch(db: Db, games: { id: string; pgn: string }[]) {
  let indexed = 0;
  let unreadable = 0;
  const rows: PositionRow[] = [];
  for (const g of games) {
    try {
      const r = positionsOf(g);
      rows.push(...r);
      if (r.length) indexed++;
    } catch {
      unreadable++;
    }
  }
  const ids = games.map((g) => g.id);
  const { error: delError } = await db.from("game_positions").delete().in("game_id", ids);
  if (delError) throw new Error(delError.message);
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from("game_positions").insert(rows.slice(i, i + 1000));
    if (error) throw new Error(error.message);
  }
  const { error: updError } = await db
    .from("games")
    .update({ positions_indexed_at: new Date().toISOString() })
    .in("id", ids);
  if (updError) throw new Error(updError.message);
  return { indexed, unreadable };
}

const BATCH = 100;

/** Indexe des parties précises (celles qu'on vient d'enregistrer ou d'importer). */
export async function indexGames(ids: string[]) {
  const db = createAdminClient();
  let indexed = 0;
  let unreadable = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data: games, error } = await db
      .from("games")
      .select("id, pgn")
      .in("id", ids.slice(i, i + BATCH));
    if (error) throw new Error(error.message);
    if (!games?.length) continue;
    const r = await indexBatch(db, games);
    indexed += r.indexed;
    unreadable += r.unreadable;
  }
  return { indexed, unreadable };
}

/** File d'attente : parties jamais indexées, les plus anciennes d'abord (tâche planifiée). */
export async function indexPendingGames(limit = 300) {
  const db = createAdminClient();
  const { data: games, error } = await db
    .from("games")
    .select("id, pgn")
    .is("positions_indexed_at", null)
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  let indexed = 0;
  let unreadable = 0;
  for (let i = 0; i < (games ?? []).length; i += BATCH) {
    const r = await indexBatch(db, games!.slice(i, i + BATCH));
    indexed += r.indexed;
    unreadable += r.unreadable;
  }
  return { indexed, unreadable, remaining: (games?.length ?? 0) === limit };
}
