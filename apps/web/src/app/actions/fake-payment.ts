"use server";

import { headers } from "next/headers";
import { getProvider } from "@/lib/payments";
import { signFake } from "@/lib/payments/fake";

/**
 * Simule le prestataire factice : envoie au webhook une notification signée,
 * exactement comme le ferait FedaPay. Indisponible si le fournisseur factice est désactivé.
 */
export async function simulateFakePayment(paymentId: string, outcome: "succeeded" | "failed" | "pending") {
  if (!getProvider("fake")) return { ok: false as const };
  const secret = process.env.FAKE_PAYMENT_SECRET!;
  const body = JSON.stringify({ payment_id: paymentId, status: outcome });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const res = await fetch(`${origin}/api/webhooks/payments/fake`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-fake-signature": signFake(secret, body) },
    body,
  });
  return { ok: res.ok as boolean };
}
