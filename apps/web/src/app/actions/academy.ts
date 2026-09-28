"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { solvesPuzzle } from "@/lib/puzzles";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Enregistre une tentative (une par puzzle, contexte et jour ; la première compte).
 * Une réussite n'est retenue que si les coups envoyés résolvent le puzzle (rejoués par le serveur).
 */
export async function recordAttemptAction(
  puzzleId: string,
  moves: string[] | null,
  context: "daily" | "challenge",
): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (
    !z.string().uuid().safeParse(puzzleId).success ||
    !["daily", "challenge"].includes(context) ||
    (moves !== null &&
      !z
        .array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/))
        .max(40)
        .safeParse(moves).success)
  )
    return { ok: false, error: "invalid" };
  const db = createAdminClient();
  const { data: puzzle } = await db
    .from("puzzles")
    .select("fen, solution")
    .eq("id", puzzleId)
    .eq("is_active", true)
    .maybeSingle();
  if (!puzzle) return { ok: false, error: "invalid" };
  const solved = moves !== null && solvesPuzzle(puzzle.fen, puzzle.solution, moves);
  // Écriture réservée au serveur (règles d'accès) : la personne ne peut pas se déclarer gagnante.
  const { error } = await db
    .from("puzzle_attempts")
    .insert({ puzzle_id: puzzleId, profile_id: session.profile.id, solved, context });
  if (error && error.code !== "23505") return { ok: false, error: "server" };
  return { ok: true };
}

export async function suggestFonAction(_prev: unknown, form: FormData): Promise<Result | null> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = z
    .object({
      termId: z.string().uuid(),
      termFon: z.string().trim().min(1).max(120),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("glossary_suggestions").insert({
    term_id: p.data.termId,
    profile_id: session.profile.id,
    term_fon: p.data.termFon,
    note: p.data.note || null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "already" : "server" };
  return { ok: true };
}
