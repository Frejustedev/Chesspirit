import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { answersSchema, customFieldSchema, PAYMENT_METHODS } from "@chesspirit/shared";
import { z } from "zod";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";
import { sendRegistrationConfirmation, startRegistrationPayment } from "@/lib/registration";
import { onlinePaymentsEnabled } from "@/lib/payments";

const input = z.object({
  tournamentId: z.string().uuid(),
  playerId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  answers: z.record(z.string(), z.unknown()).default({}),
  acceptRules: z.literal(true),
});

/**
 * Inscription depuis l'application mobile : jeton Supabase de l'utilisateur (Authorization: Bearer),
 * mêmes règles que le site (fonction register_for_tournament sous RLS), paiement démarré côté serveur.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([\w.-]{20,4096})$/)?.[1];
  if (!token) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  const supabase = createSupabase<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 16_384)
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  const { tournamentId, playerId, paymentMethod, answers } = parsed.data;
  if (paymentMethod === "online" && !(await onlinePaymentsEnabled()))
    return NextResponse.json({ ok: false, error: "payment_unavailable" }, { status: 409 });
  const { data: form } = await supabase
    .from("registration_forms")
    .select("fields")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  const fields = z
    .array(customFieldSchema)
    .catch([])
    .parse(form?.fields ?? []);
  const a = answersSchema(fields).safeParse(answers);
  if (!a.success)
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  const { data: reg, error } = await supabase.rpc("register_for_tournament", {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
    p_answers: a.data as Record<string, string | number | boolean>,
    p_payment_method: paymentMethod,
  });
  if (error || !reg)
    return NextResponse.json({ ok: false, error: error?.message ?? "server" }, { status: 400 });
  if (reg.status === "pending_payment") {
    try {
      const url = await startRegistrationPayment(reg.id, user.id);
      return NextResponse.json({ ok: true, paymentUrl: url });
    } catch {
      return NextResponse.json({ ok: false, error: "payment_unavailable" }, { status: 503 });
    }
  }
  await sendRegistrationConfirmation(reg.id).catch(() => null);
  return NextResponse.json({ ok: true, ticketUrl: `${env.siteUrl}/billet/${reg.ticket_code}` });
}
