"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

/** Enregistre une tentative (une par puzzle, contexte et jour ; la première compte). */
export async function recordAttemptAction(
  puzzleId: string,
  solved: boolean,
  context: "daily" | "challenge",
): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (!z.string().uuid().safeParse(puzzleId).success || !["daily", "challenge"].includes(context))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
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
