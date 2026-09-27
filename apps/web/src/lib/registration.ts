import "server-only";
import { formatDate, formatXof } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider, activeProviderId } from "@/lib/payments";
import { notify, type Message } from "@/lib/notifications";
import { env } from "@/lib/env";

/** Crée le paiement d'une inscription et renvoie l'URL de paiement du prestataire. */
export async function startRegistrationPayment(
  registrationId: string,
  userId: string,
): Promise<string> {
  const db = createAdminClient();
  const { data: reg, error } = await db
    .from("registrations")
    .select(
      "id, amount_xof, payment_status, player_id, tournaments(name, slug), profiles!registrations_player_id_fkey(first_name, last_name, email, phone)",
    )
    .eq("id", registrationId)
    .single();
  if (error || !reg) throw new Error("registration_not_found");
  if (reg.payment_status !== "pending" || !reg.amount_xof) throw new Error("payment_not_required");

  const provider = getProvider();
  if (!provider) throw new Error("payment_provider_unavailable");

  // Réutilise un paiement en attente existant plutôt que d'en créer un second.
  const { data: existing } = await db
    .from("payments")
    .select("id, checkout_url")
    .eq("object_type", "registration")
    .eq("object_id", reg.id)
    .eq("status", "pending")
    .eq("provider", provider.id)
    .maybeSingle();
  if (existing?.checkout_url) return existing.checkout_url;

  const { data: pay, error: payErr } = await db
    .from("payments")
    .insert({
      provider: provider.id,
      amount_xof: reg.amount_xof,
      object_type: "registration",
      object_id: reg.id,
      payer_profile_id: reg.player_id,
      user_id: userId,
      description: `Inscription — ${reg.tournaments?.name ?? ""}`,
    })
    .select("id")
    .single();
  if (payErr || !pay) throw new Error("payment_create_failed");

  const checkout = await provider.createCheckout({
    paymentId: pay.id,
    amountXof: reg.amount_xof,
    description: `Inscription — ${reg.tournaments?.name ?? "tournoi"}`,
    customer: {
      firstName: reg.profiles?.first_name ?? "",
      lastName: reg.profiles?.last_name ?? "",
      email: reg.profiles?.email,
      phone: reg.profiles?.phone,
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

/** Confirmation d'inscription par SMS, WhatsApp et e-mail (selon les coordonnées disponibles). */
export async function sendRegistrationConfirmation(registrationId: string) {
  const db = createAdminClient();
  const { data: r } = await db
    .from("registrations")
    .select(
      "ticket_code, status, payment_status, amount_xof, player_id, tournaments(name, starts_at, venue), profiles!registrations_player_id_fkey(first_name, phone, email, preferred_locale, guardian_id, notification_prefs)",
    )
    .eq("id", registrationId)
    .single();
  if (!r || !r.profiles || !r.tournaments) return;
  let { phone, email } = r.profiles;
  if (!phone && !email && r.profiles.guardian_id) {
    const { data: g } = await db
      .from("profiles")
      .select("phone, email")
      .eq("id", r.profiles.guardian_id)
      .single();
    phone = g?.phone ?? null;
    email = g?.email ?? null;
  }
  const date = formatDate(r.tournaments.starts_at, "fr");
  const due =
    r.payment_status === "due_on_site" && r.amount_xof
      ? ` Frais à régler sur place : ${formatXof(r.amount_xof)}.`
      : "";
  const text = `Chesspirit : inscription ${r.status === "waitlisted" ? "en liste d'attente" : "confirmée"} pour ${r.profiles.first_name} — ${r.tournaments.name}, ${date}${r.tournaments.venue ? `, ${r.tournaments.venue}` : ""}.${due} Billet : ${env.siteUrl}/billet/${r.ticket_code}`;
  const prefs = (r.profiles.notification_prefs ?? {}) as Record<string, boolean>;
  const msgs: Message[] = [];
  if (phone && prefs.sms !== false)
    msgs.push({
      profileId: r.player_id,
      channel: "sms",
      to: phone,
      template: "registration_confirmed",
      text,
    });
  if (phone && prefs.whatsapp)
    msgs.push({
      profileId: r.player_id,
      channel: "whatsapp",
      to: phone,
      template: "registration_confirmed",
      text,
    });
  if (email && prefs.email !== false)
    msgs.push({
      profileId: r.player_id,
      channel: "email",
      to: email,
      template: "registration_confirmed",
      subject: `Inscription — ${r.tournaments.name}`,
      text,
    });
  await notify(msgs);
}
