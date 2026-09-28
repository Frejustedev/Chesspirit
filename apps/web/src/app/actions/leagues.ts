"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { startPayment } from "@/lib/payments/checkout";
import { onlinePaymentsEnabled } from "@/lib/payments";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();

/** Licence de ligue : montant fixé par la saison ; paiement confirmé par webhook. */
export async function requestLicenseAction(
  seasonId: string,
  profileId: string,
): Promise<Result<{ redirect?: string }>> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (!uuid.safeParse(seasonId).success || !uuid.safeParse(profileId).success)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: fee } = await supabase
    .from("seasons")
    .select("license_fee_xof")
    .eq("id", seasonId)
    .maybeSingle();
  if ((fee?.license_fee_xof ?? 0) > 0 && !(await onlinePaymentsEnabled()))
    return { ok: false, error: "payment_unavailable" };
  const { data: lic, error } = await supabase.rpc("request_league_license", {
    p_season: seasonId,
    p_profile: profileId,
  });
  if (error || !lic) return { ok: false, error: error?.message ?? "server" };
  revalidatePath("/compte/ligues");
  if (lic.status !== "pending_payment") return { ok: true, data: {} };
  const { data: season } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", seasonId)
    .single();
  try {
    const url = await startPayment({
      objectType: "league_license",
      objectId: lic.id,
      amountXof: lic.amount_xof,
      description: `Licence de ligue — ${season?.name ?? ""}`,
      userId: session.userId,
      payer: {
        profileId,
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

const postponeSchema = z.object({
  pairingId: uuid,
  profileId: uuid,
  reason: z.string().trim().min(5).max(1000),
  proposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function requestPostponementAction(raw: unknown): Promise<Result> {
  const p = postponeSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("league_postponements").insert({
    pairing_id: p.data.pairingId,
    requested_by: p.data.profileId,
    reason: p.data.reason,
    proposed_date: p.data.proposedDate ?? null,
  });
  if (error)
    return { ok: false, error: error.code === "23505" ? "already_requested" : "forbidden" };
  revalidatePath("/compte/ligues");
  return { ok: true };
}

export async function agreePostponementAction(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("agree_postponement", { p_id: id });
  if (error) return { ok: false, error: "forbidden" };
  revalidatePath("/compte/ligues");
  return { ok: true };
}

/** Décision de l'arbitre (l'accord des deux joueurs est requis pour approuver). */
export async function decidePostponementAction(id: string, approve: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const session = await getSession();
  const supabase = await createClient();
  const { data: lp } = await supabase
    .from("league_postponements")
    .select("opponent_agreed")
    .eq("id", id)
    .maybeSingle();
  if (!lp) return { ok: false, error: "forbidden" };
  if (approve && !lp.opponent_agreed) return { ok: false, error: "opponent_not_agreed" };
  const { data, error } = await supabase
    .from("league_postponements")
    .update({ status: approve ? "approved" : "refused", decided_by: session?.userId })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/ligues");
  revalidatePath("/compte/ligues");
  return { ok: true };
}
