import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider, type ProviderId } from "@/lib/payments";
import { amountMismatch } from "@/lib/payments/amount";
import { sendRegistrationConfirmation } from "@/lib/registration";
import { bookingConfirmation } from "@/lib/coaching/notify";
import { orderConfirmation } from "@/lib/shop/notify";

/**
 * Webhook des prestataires de paiement. Seule une notification à la signature vérifiée
 * peut confirmer un paiement (jamais le simple retour du navigateur).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: id } = await params;
  const provider = ["fake", "fedapay", "kkiapay"].includes(id)
    ? getProvider(id as ProviderId)
    : null;
  if (!provider) return NextResponse.json({ error: "provider_disabled" }, { status: 404 });

  // Taille bornée : aucune notification légitime ne dépasse quelques kilo-octets.
  if (Number(request.headers.get("content-length") ?? 0) > 65_536)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 65_536) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const event = await provider.verifyWebhook(raw, request.headers).catch(() => null);
  const db = createAdminClient();
  let payload: unknown;
  if (!event) {
    // Signature invalide : on ne conserve qu'un extrait (pas de stockage arbitraire).
    payload = { excerpt: raw.slice(0, 500), length: raw.length };
  } else {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw: raw.slice(0, 2000) };
    }
  }
  const { data: log } = await db
    .from("payment_webhooks")
    .insert({
      provider: id,
      event_type: event?.type ?? null,
      signature_valid: !!event,
      payload: payload as never,
    })
    .select("id")
    .single();
  if (!event) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  let q = db
    .from("payments")
    .select("id, object_type, object_id, status, amount_xof")
    .eq("provider", provider.id);
  q = event.paymentId ? q.eq("id", event.paymentId) : q.eq("provider_ref", event.providerRef ?? "");
  const { data: payment } = await q.maybeSingle();
  if (!payment) {
    await db
      .from("payment_webhooks")
      .update({ error: "payment_not_found", processed_at: new Date().toISOString() })
      .eq("id", log!.id);
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (event.status === "pending") {
    await db
      .from("payment_webhooks")
      .update({ payment_id: payment.id, processed_at: new Date().toISOString() })
      .eq("id", log!.id);
    return NextResponse.json({ ok: true });
  }
  // Le montant payé doit correspondre exactement au montant attendu (le widget est côté navigateur).
  const mismatch = amountMismatch(provider.id, event, payment.amount_xof);
  const { error } = await db.rpc("confirm_payment", {
    p_payment_id: payment.id,
    p_status: mismatch ? "failed" : event.status,
    p_provider_ref: event.providerRef ?? "",
    p_reason: mismatch ? "amount_mismatch" : event.status === "succeeded" ? undefined : event.type,
  });
  await db
    .from("payment_webhooks")
    .update({
      payment_id: payment.id,
      processed_at: new Date().toISOString(),
      error: error?.message ?? null,
    })
    .eq("id", log!.id);
  if (error) return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
  if (
    event.status === "succeeded" &&
    !mismatch &&
    payment.status !== "succeeded" &&
    payment.object_type === "registration"
  ) {
    await sendRegistrationConfirmation(payment.object_id).catch((e) => console.error(e));
  }
  if (
    event.status === "succeeded" &&
    !mismatch &&
    payment.status !== "succeeded" &&
    payment.object_type === "booking"
  ) {
    await bookingConfirmation(payment.object_id).catch((e) => console.error(e));
  }
  if (
    event.status === "succeeded" &&
    !mismatch &&
    payment.status !== "succeeded" &&
    payment.object_type === "order"
  ) {
    await orderConfirmation(payment.object_id).catch((e) => console.error(e));
  }
  return NextResponse.json({ ok: true });
}
