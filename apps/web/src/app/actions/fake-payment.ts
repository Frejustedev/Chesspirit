"use server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments";
import { signFake } from "@/lib/payments/fake";

/**
 * Simule le prestataire factice : envoie au webhook une notification signée,
 * exactement comme le ferait FedaPay. Indisponible si le fournisseur factice est désactivé.
 */
export async function simulateFakePayment(
  paymentId: string,
  outcome: "succeeded" | "failed" | "pending",
) {
  if (!getProvider("fake") || !/^[0-9a-f-]{36}$/.test(paymentId)) return { ok: false as const };
  // Seul le payeur (ou un administrateur) peut simuler le paiement : lecture sous RLS.
  const { data: visible } = await (
    await createClient()
  )
    .from("payments")
    .select("id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!visible) return { ok: false as const };
  const secret = process.env.FAKE_PAYMENT_SECRET!;
  const body = JSON.stringify({ payment_id: paymentId, status: outcome });
  // Adresse du site configurée (jamais l'en-tête Host, contrôlable par le client).
  const res = await fetch(`${env.siteUrl}/api/webhooks/payments/fake`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-fake-signature": signFake(secret, body) },
    body,
  });
  return { ok: res.ok as boolean };
}
