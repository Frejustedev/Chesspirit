"use server";

import { revalidatePath } from "next/cache";
import { Chess } from "chess.js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { readScoresheet } from "@/lib/ocr";
import { indexPendingGames } from "@/lib/positions";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();

async function enabled() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "scoresheet_ocr")
    .maybeSingle();
  return !!data?.enabled;
}

/** Lecture d'une photo de feuille ; l'image n'est pas conservée. */
export async function readScoresheetAction(
  form: FormData,
): Promise<Result<{ moves: string; simulated: boolean }>> {
  if (!(await enabled())) return { ok: false, error: "disabled" };
  const tournamentId = String(form.get("tournamentId") ?? "");
  const file = form.get("photo");
  if (!uuid.safeParse(tournamentId).success || !(file instanceof File))
    return { ok: false, error: "invalid" };
  // Lecture seule (rien n'est écrit) : rôle d'équipe suffisant ; l'enregistrement est contrôlé par RLS.
  const session = await getSession();
  if (!session?.roles.some((r) => ["admin", "super_admin", "arbiter", "organizer"].includes(r)))
    return { ok: false, error: "forbidden" };
  try {
    return { ok: true, data: await readScoresheet(file) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const saveSchema = z.object({ pairingId: uuid, moves: z.string().trim().min(2).max(5000) });

/** Enregistre la partie relue par l'arbitre (coups validés par chess.js, résultat de l'appariement). */
export async function saveScoresheetGameAction(raw: unknown): Promise<Result<{ gameId: string }>> {
  if (!(await enabled())) return { ok: false, error: "disabled" };
  const p = saveSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const session = await getSession();
  const supabase = await createClient();
  const { data: pr } = await supabase
    .from("pairings")
    .select(
      "id, tournament_id, round_id, board, result, white_id, black_id, rounds(number), tournaments(name, starts_at, cadence)",
    )
    .eq("id", p.data.pairingId)
    .maybeSingle();
  if (!pr || !pr.black_id) return { ok: false, error: "invalid" };
  const result = ["1-0", "0-1", "1/2-1/2"].includes(pr.result ?? "") ? pr.result! : "*";
  const chess = new Chess();
  try {
    chess.loadPgn(p.data.moves.replace(/\s+/g, " "));
  } catch {
    return { ok: false, error: "illegal_moves" };
  }
  if (!chess.history().length) return { ok: false, error: "illegal_moves" };
  const { data: names } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", [pr.white_id, pr.black_id]);
  const nameOf = (id: string) => names?.find((n) => n.id === id)?.display_name ?? "?";
  chess.header(
    "Event",
    pr.tournaments?.name ?? "",
    "Round",
    String(pr.rounds?.number ?? ""),
    "White",
    nameOf(pr.white_id),
    "Black",
    nameOf(pr.black_id),
    "Result",
    result,
  );
  const { data: existing } = await supabase
    .from("games")
    .select("id")
    .eq("pairing_id", pr.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "already_exists" };
  const { data: g, error } = await supabase
    .from("games")
    .insert({
      tournament_id: pr.tournament_id,
      round_id: pr.round_id,
      pairing_id: pr.id,
      round_number: pr.rounds?.number ?? null,
      board: pr.board,
      white_id: pr.white_id,
      black_id: pr.black_id,
      white_name: nameOf(pr.white_id),
      black_name: nameOf(pr.black_id),
      result,
      pgn: chess.pgn(),
      moves_count: Math.ceil(chess.history().length / 2),
      played_on: pr.tournaments?.starts_at.slice(0, 10) ?? null,
      cadence: pr.tournaments?.cadence ?? null,
      source: "ocr",
      validated_by: session?.userId ?? null,
      validated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !g) return { ok: false, error: "forbidden" };
  await indexPendingGames(20).catch(() => null);
  revalidatePath(`/admin/tournois/${pr.tournament_id}`);
  return { ok: true, data: { gameId: g.id } };
}
