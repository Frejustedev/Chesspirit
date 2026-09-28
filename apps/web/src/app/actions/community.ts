"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Chess } from "chess.js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { startPayment } from "@/lib/payments/checkout";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { REFERRAL_COOKIE } from "@/lib/referral";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();

/** Adhésion : gratuite immédiatement active ; premium payée au tarif fixé en base (confirmée par webhook). */
export async function requestMembershipAction(
  plan: "free" | "premium",
): Promise<Result<{ redirect?: string }>> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (plan !== "free" && plan !== "premium") return { ok: false, error: "invalid" };
  if (plan === "premium" && !(await onlinePaymentsEnabled()))
    return { ok: false, error: "payment_unavailable" };
  const supabase = await createClient();
  const { data: m, error } = await supabase.rpc("request_membership", { p_plan: plan });
  if (error || !m) return { ok: false, error: error?.message ?? "server" };
  await supabase.rpc("refresh_badges", { p_profile: session.profile.id });
  revalidatePath("/communaute/adhesion");
  if (m.status !== "pending_payment") return { ok: true, data: {} };
  try {
    const url = await startPayment({
      objectType: "membership",
      objectId: m.id,
      amountXof: m.amount_xof,
      description: `Adhésion ${plan === "premium" ? "premium" : ""} Chesspirit — ${m.card_number}`,
      userId: session.userId,
      payer: {
        profileId: session.profile.id,
        firstName: session.profile.first_name,
        lastName: session.profile.last_name,
        email: session.profile.email,
        phone: session.profile.phone,
      },
    });
    return { ok: true, data: { redirect: url } };
  } catch {
    return { ok: false, error: "payment_unavailable" };
  }
}

const ambassadorSchema = z.object({
  city: z.string().trim().min(2).max(80),
  motivation: z.string().trim().min(20).max(2000),
});

export async function applyAmbassadorAction(_prev: Result | null, form: FormData): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = ambassadorSchema.safeParse({
    city: form.get("city"),
    motivation: form.get("motivation"),
  });
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ambassadors")
    .insert({ profile_id: session.profile.id, city: p.data.city, motivation: p.data.motivation });
  if (error) return { ok: false, error: error.code === "23505" ? "already_applied" : "server" };
  revalidatePath("/communaute/ambassadeurs");
  return { ok: true };
}

/** Code de parrainage saisi à la main (dans les 30 jours suivant l'inscription). */
export async function claimReferralAction(_prev: Result | null, form: FormData): Promise<Result> {
  const code = String(form.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return { ok: false, error: "invalid_code" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_referral", { p_code: code });
  if (error) return { ok: false, error: "auth_required" };
  if (!data) return { ok: false, error: "referral_refused" };
  return { ok: true };
}

/** Parrainage mémorisé par le lien ?parrain= : appliqué une fois le profil créé. */
export async function claimReferralFromCookie(): Promise<void> {
  const jar = await cookies();
  const code = jar.get(REFERRAL_COOKIE)?.value;
  if (!code) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_referral", { p_code: code });
  if (!error) jar.delete(REFERRAL_COOKIE);
}

export async function castAwardVoteAction(nomineeId: string): Promise<Result> {
  if (!uuid.safeParse(nomineeId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_award_vote", { p_nominee: nomineeId });
  if (error)
    return {
      ok: false,
      error: error.message.includes("voting_closed") ? "voting_closed" : "auth_required",
    };
  revalidatePath("/communaute/awards");
  return { ok: true };
}

export async function predictAction(
  pairingId: string,
  result: "1-0" | "1/2-1/2" | "0-1",
): Promise<Result> {
  if (!uuid.safeParse(pairingId).success || !["1-0", "1/2-1/2", "0-1"].includes(result))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("predict", { p_pairing: pairingId, p_result: result });
  if (error)
    return {
      ok: false,
      error: error.message.includes("prediction_closed") ? "prediction_closed" : "auth_required",
    };
  revalidatePath("/communaute/pronostics");
  return { ok: true };
}

const uciRe = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Vote du public : le coup doit être légal dans la position affichée. */
export async function pvmVoteAction(gameId: string, move: string): Promise<Result> {
  if (!uuid.safeParse(gameId).success || !uciRe.test(move)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("pvm_games")
    .select("fen, slug")
    .eq("id", gameId)
    .maybeSingle();
  if (!g) return { ok: false, error: "invalid" };
  if (!legalUci(g.fen, move)) return { ok: false, error: "illegal_move" };
  const { error } = await supabase.rpc("pvm_vote", { p_game: gameId, p_move: move });
  if (error)
    return {
      ok: false,
      error: error.message.includes("vote_closed") ? "vote_closed" : "auth_required",
    };
  revalidatePath(`/communaute/public-contre-le-maitre/${g.slug}`);
  return { ok: true };
}

function legalUci(fen: string, uci: string) {
  try {
    const c = new Chess(fen);
    return !!c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return false;
  }
}

/**
 * Joue un coup dans la partie (maître, ou coup du public le plus voté) ; validé par chess.js.
 * Mise à jour conditionnelle sur la FEN lue pour éviter deux coups simultanés.
 * Les règles d'accès limitent l'écriture à l'administration et au maître rattaché.
 */
async function playMove(gameId: string, pick: (fen: string) => Promise<string | null>) {
  const supabase = await createClient();
  const { data: g } = await supabase.from("pvm_games").select("*").eq("id", gameId).maybeSingle();
  if (!g || g.status !== "open") return { ok: false as const, error: "invalid" };
  const uci = await pick(g.fen);
  if (!uci) return { ok: false as const, error: "no_votes" };
  const c = new Chess(g.fen);
  let san: string;
  try {
    san = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return { ok: false as const, error: "illegal_move" };
  }
  const over = c.isGameOver();
  const result = !over ? null : c.isCheckmate() ? (c.turn() === "w" ? "0-1" : "1-0") : "1/2-1/2";
  const publicToMove = c.turn() === g.public_color;
  const { data, error } = await supabase
    .from("pvm_games")
    .update({
      fen: c.fen(),
      moves: [...g.moves, san],
      status: over ? "finished" : "open",
      result,
      vote_ends_at:
        !over && publicToMove ? new Date(Date.now() + g.vote_minutes * 60_000).toISOString() : null,
    })
    .eq("id", g.id)
    .eq("fen", g.fen)
    .select("id");
  if (error || !data?.length) return { ok: false as const, error: "forbidden" };
  revalidatePath(`/communaute/public-contre-le-maitre/${g.slug}`);
  revalidatePath("/communaute/public-contre-le-maitre");
  return { ok: true as const };
}

export async function pvmMasterMoveAction(gameId: string, move: string): Promise<Result> {
  if (!uuid.safeParse(gameId).success || !uciRe.test(move)) return { ok: false, error: "invalid" };
  return playMove(gameId, async (fen) => {
    const side = fen.split(" ")[1];
    const supabase = await createClient();
    const { data: g } = await supabase
      .from("pvm_games")
      .select("public_color")
      .eq("id", gameId)
      .single();
    return g && side !== g.public_color ? move : null;
  });
}

/** Clôt le vote : le coup légal le plus voté est joué (égalité : ordre alphabétique, comme le décompte). */
export async function pvmPlayPublicMoveAction(gameId: string): Promise<Result> {
  if (!uuid.safeParse(gameId).success) return { ok: false, error: "invalid" };
  return playMove(gameId, async (fen) => {
    const supabase = await createClient();
    const { data: tally } = await supabase.rpc("pvm_tally", { p_game: gameId });
    return (tally ?? []).find((t) => legalUci(fen, t.move))?.move ?? null;
  });
}

export async function pvmFinishAction(
  gameId: string,
  result: "1-0" | "1/2-1/2" | "0-1",
): Promise<Result> {
  if (!uuid.safeParse(gameId).success || !["1-0", "1/2-1/2", "0-1"].includes(result))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pvm_games")
    .update({ status: "finished", result, vote_ends_at: null })
    .eq("id", gameId)
    .select("slug");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath(`/communaute/public-contre-le-maitre/${data[0]!.slug}`);
  return { ok: true };
}
