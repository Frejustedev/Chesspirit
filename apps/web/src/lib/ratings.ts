import "server-only";
import {
  replayRatings,
  type OtbCadence,
  type ReplayInput,
  type ReplayOutput,
  type Score,
} from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";

const SCORES: Record<string, Score> = { "1-0": 1, "0-1": 0, "1/2-1/2": 0.5 };

/**
 * Recalcule toutes les cotes Chesspirit en présentiel en rejouant les tournois homologués terminés.
 * Idempotent : peut être relancé à tout moment (après une réclamation validée, par exemple).
 * Calcul confié au service Python ; repli sur l'implémentation TypeScript identique.
 */
export async function recomputeAllRatings(): Promise<{
  engine: "python" | "typescript";
  tournaments: number;
  players: number;
}> {
  const db = createAdminClient();
  const { data: ts } = await db
    .from("tournaments")
    .select("id, starts_at, cadence")
    .eq("rated", true)
    .in("status", ["finished", "archived"])
    .not("cadence", "is", null);
  const tournaments = ts ?? [];
  const ids = tournaments.map((t) => t.id);
  const pairings = ids.length
    ? ((
        await db
          .from("pairings")
          .select("tournament_id, white_id, black_id, result, stage")
          .in("tournament_id", ids)
          .eq("stage", "main")
          .not("black_id", "is", null)
      ).data ?? [])
    : [];
  const playerIds = [...new Set(pairings.flatMap((p) => [p.white_id, p.black_id!]))];
  const { data: profiles } = playerIds.length
    ? await db.from("profiles").select("id, birth_date, fide_id").in("id", playerIds)
    : { data: [] };
  const fideIds = (profiles ?? []).map((p) => p.fide_id).filter((x): x is string => !!x);
  const { data: fide } = fideIds.length
    ? await db
        .from("fide_ratings")
        .select("fide_id, period, standard, rapid, blitz")
        .in("fide_id", fideIds)
        .order("period", { ascending: false })
    : { data: [] };
  const latestFide = new Map<
    string,
    { standard: number | null; rapid: number | null; blitz: number | null }
  >();
  for (const f of fide ?? []) if (!latestFide.has(f.fide_id)) latestFide.set(f.fide_id, f);
  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "default_start_rating")
    .maybeSingle();

  const input: ReplayInput = {
    startRating: Number(setting?.value ?? 1200),
    players: Object.fromEntries(
      (profiles ?? []).map((p) => {
        const f = p.fide_id ? latestFide.get(p.fide_id) : undefined;
        return [
          p.id,
          {
            birthDate: p.birth_date,
            fide: f ? { classical: f.standard, rapid: f.rapid, blitz: f.blitz } : null,
          },
        ];
      }),
    ),
    tournaments: tournaments.map((t) => ({
      id: t.id,
      date: t.starts_at,
      cadence: t.cadence as OtbCadence,
      games: pairings
        .filter((p) => p.tournament_id === t.id && p.result && p.result in SCORES)
        .map((p) => ({ white: p.white_id, black: p.black_id!, score: SCORES[p.result!]! })),
    })),
  };

  let out: ReplayOutput;
  let engine: "python" | "typescript" = "typescript";
  try {
    const url = process.env.CHESS_ENGINE_URL;
    const key = process.env.CHESS_ENGINE_KEY;
    if (!url || !key) throw new Error("engine_not_configured");
    const res = await fetch(`${url}/ratings/replay-tournaments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-engine-key": key },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`engine_${res.status}`);
    out = (await res.json()) as ReplayOutput;
    engine = "python";
  } catch {
    out = replayRatings(input);
  }

  // Écriture : historique lié aux tournois recréé, cotes des joueurs concernés mises à jour.
  if (ids.length) await db.from("rating_history").delete().in("tournament_id", ids);
  const dates = new Map(tournaments.map((t) => [t.id, t.starts_at.slice(0, 10)]));
  if (out.history.length) {
    for (let i = 0; i < out.history.length; i += 500) {
      await db.from("rating_history").insert(
        out.history.slice(i, i + 500).map((h) => ({
          profile_id: h.playerId,
          type: h.cadence,
          tournament_id: h.tournamentId,
          rating_before: h.before,
          rating_after: h.after,
          games: h.games,
          effective_on: dates.get(h.tournamentId)!,
        })),
      );
    }
  }
  const rows = (
    Object.entries(out.ratings) as [OtbCadence, ReplayOutput["ratings"][OtbCadence]][]
  ).flatMap(([type, m]) =>
    Object.entries(m).map(([profile_id, s]) => ({
      profile_id,
      type,
      rating: s.rating,
      games: s.games,
      provisional: s.provisional,
      peak: s.peak,
    })),
  );
  if (rows.length) await db.from("ratings").upsert(rows, { onConflict: "profile_id,type" });
  for (const h of out.history) {
    await db
      .from("standings")
      .update({ rating_before: h.before, rating_after: h.after, rating_delta: h.after - h.before })
      .eq("tournament_id", h.tournamentId)
      .eq("player_id", h.playerId);
  }
  await db.from("audit_logs").insert({
    action: "recompute_ratings",
    object_type: "ratings",
    after: { engine, tournaments: ids.length, players: playerIds.length },
  });
  return { engine, tournaments: ids.length, players: playerIds.length };
}
