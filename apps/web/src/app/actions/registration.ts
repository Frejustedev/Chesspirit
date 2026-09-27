"use server";

import { answersSchema, customFieldSchema, PAYMENT_METHODS } from "@chesspirit/shared";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { sendRegistrationConfirmation, startRegistrationPayment } from "@/lib/registration";

const input = z.object({
  tournamentId: z.string().uuid(),
  playerId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  answers: z.record(z.string(), z.unknown()).default({}),
  acceptRules: z.literal(true),
});

export type RegisterResult = { ok: true; redirect: string } | { ok: false; error: string };

export async function registerAction(raw: unknown): Promise<RegisterResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "auth_required" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { tournamentId, playerId, paymentMethod, answers } = parsed.data;
  const supabase = await createClient();

  // Validation des champs personnalisés côté serveur (mêmes schémas que le client).
  const { data: form } = await supabase.from("registration_forms").select("fields").eq("tournament_id", tournamentId).maybeSingle();
  const fields = z.array(customFieldSchema).catch([]).parse(form?.fields ?? []);
  const a = answersSchema(fields).safeParse(answers);
  if (!a.success) return { ok: false, error: "invalid_answers" };

  const { data: reg, error } = await supabase.rpc("register_for_tournament", {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
    p_answers: a.data as Record<string, string | number | boolean>,
    p_payment_method: paymentMethod,
  });
  if (error || !reg) return { ok: false, error: error?.message ?? "server" };

  if (reg.status === "pending_payment") {
    try {
      const url = await startRegistrationPayment(reg.id, session.userId);
      return { ok: true, redirect: url };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "payment_unavailable" };
    }
  }
  await sendRegistrationConfirmation(reg.id).catch((e) => console.error(e));
  return { ok: true, redirect: `/billet/${reg.ticket_code}` };
}

export async function resumePaymentAction(registrationId: string): Promise<RegisterResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "auth_required" };
  const supabase = await createClient();
  const { data: reg } = await supabase.from("registrations").select("id").eq("id", registrationId).maybeSingle();
  if (!reg) return { ok: false, error: "forbidden" };
  try {
    return { ok: true, redirect: await startRegistrationPayment(reg.id, session.userId) };
  } catch {
    return { ok: false, error: "payment_unavailable" };
  }
}
