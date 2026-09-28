"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OfflinePack = {
  tournamentId: string;
  name: string;
  savedAt: string;
  rounds: {
    id: string;
    number: number;
    pairings: {
      id: string;
      board: number;
      white: string;
      black: string | null;
      result: string | null;
    }[];
  }[];
};

/** Paquet hors ligne : rondes non terminées d'un tournoi que l'utilisateur arbitre (lecture sous RLS). */
export async function offlinePackAction(tournamentId: string): Promise<OfflinePack | null> {
  if (!z.string().uuid().safeParse(tournamentId).success) return null;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return null;
  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, number, status")
    .eq("tournament_id", tournamentId)
    .order("number", { ascending: false })
    .limit(2);
  if (!rounds?.length)
    return { tournamentId, name: t.name, savedAt: new Date().toISOString(), rounds: [] };
  const { data: pairings } = await supabase
    .from("pairings")
    .select("id, round_id, board, result, white_id, black_id, stage")
    .in(
      "round_id",
      rounds.map((r) => r.id),
    )
    .eq("stage", "main")
    .order("board");
  // Noms via la liste d'inscrits (le staff du tournoi y a accès).
  const ids = [
    ...new Set((pairings ?? []).flatMap((p) => [p.white_id, p.black_id]).filter(Boolean)),
  ] as string[];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids)
    : { data: [] };
  const name = (id: string | null) => {
    const p = people?.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };
  return {
    tournamentId,
    name: t.name,
    savedAt: new Date().toISOString(),
    rounds: rounds.map((r) => ({
      id: r.id,
      number: r.number,
      pairings: (pairings ?? [])
        .filter((p) => p.round_id === r.id)
        .map((p) => ({
          id: p.id,
          board: p.board,
          white: name(p.white_id),
          black: p.black_id ? name(p.black_id) : null,
          result: p.result,
        })),
    })),
  };
}
