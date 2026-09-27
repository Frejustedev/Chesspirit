import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeProviderId, getProvider } from "@/lib/payments";
import { env } from "@/lib/env";

export type PayableType =
  "registration" | "booking" | "order" | "membership" | "league_license" | "gift_card";

/**
 * Crée (ou réutilise) un paiement en attente pour un objet et renvoie l'URL du prestataire.
 * Le montant vient toujours de la base, jamais du navigateur.
 */
export async function startPayment(input: {
  objectType: PayableType;
  objectId: string;
  amountXof: number;
  description: string;
  userId: string;
  payer: {
    profileId: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
}): Promise<string> {
  const db = createAdminClient();
  const provider = getProvider();
  if (!provider) throw new Error("payment_provider_unavailable");
  const { data: existing } = await db
    .from("payments")
    .select("id, checkout_url")
    .eq("object_type", input.objectType)
    .eq("object_id", input.objectId)
    .eq("status", "pending")
    .eq("provider", provider.id)
    .maybeSingle();
  if (existing?.checkout_url) return existing.checkout_url;
  const { data: pay, error } = await db
    .from("payments")
    .insert({
      provider: provider.id,
      amount_xof: input.amountXof,
      object_type: input.objectType,
      object_id: input.objectId,
      payer_profile_id: input.payer.profileId,
      user_id: input.userId,
      description: input.description,
    })
    .select("id")
    .single();
  if (error || !pay) throw new Error("payment_create_failed");
  const checkout = await provider.createCheckout({
    paymentId: pay.id,
    amountXof: input.amountXof,
    description: input.description,
    customer: {
      firstName: input.payer.firstName,
      lastName: input.payer.lastName,
      email: input.payer.email,
      phone: input.payer.phone,
    },
    returnUrl: `${env.siteUrl}/paiement/retour?payment=${pay.id}`,
    webhookUrl: `${env.siteUrl}/api/webhooks/payments/${activeProviderId()}`,
  });
  await db
    .from("payments")
    .update({ provider_ref: checkout.providerRef, checkout_url: checkout.checkoutUrl })
    .eq("id", pay.id);
  return checkout.checkoutUrl;
}
