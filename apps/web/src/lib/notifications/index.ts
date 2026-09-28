import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notifications transactionnelles. Sans clé, les fournisseurs sont factices : le message est
 * écrit dans les journaux et dans la table `notifications` (statut « skipped »), rien n'est envoyé.
 */
type Channel = "email" | "sms" | "whatsapp";

export interface Message {
  profileId?: string | null;
  channel: Channel;
  to: string;
  template: string;
  subject?: string;
  text: string;
  /** Modèle WhatsApp approuvé (obligatoire hors fenêtre de 24 h) : nom et paramètres du corps. */
  whatsappTemplate?: { name: string; params: string[] };
}

async function deliver(m: Message): Promise<{
  status: "sent" | "skipped" | "failed";
  provider: string;
  ref?: string;
  error?: string;
}> {
  try {
    if (m.channel === "email" && process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Chesspirit <no-reply@chesspirit.com>",
          to: m.to,
          subject: m.subject ?? "Chesspirit",
          text: m.text,
        }),
      });
      const j = (await r.json()) as { id?: string; message?: string };
      return r.ok
        ? { status: "sent", provider: "resend", ref: j.id }
        : { status: "failed", provider: "resend", error: j.message };
    }
    if (
      m.channel === "sms" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    ) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: m.to, From: process.env.TWILIO_FROM, Body: m.text }),
      });
      const j = (await r.json()) as { sid?: string; message?: string };
      return r.ok
        ? { status: "sent", provider: "twilio", ref: j.sid }
        : { status: "failed", provider: "twilio", error: j.message };
    }
    if (
      m.channel === "whatsapp" &&
      process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
    ) {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            m.whatsappTemplate
              ? {
                  messaging_product: "whatsapp",
                  to: m.to.replace(/^\+/, ""),
                  type: "template",
                  template: {
                    name: m.whatsappTemplate.name,
                    language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "fr" },
                    components: [
                      {
                        type: "body",
                        parameters: m.whatsappTemplate.params.map((text) => ({
                          type: "text",
                          text,
                        })),
                      },
                    ],
                  },
                }
              : {
                  messaging_product: "whatsapp",
                  to: m.to.replace(/^\+/, ""),
                  type: "text",
                  text: { body: m.text },
                },
          ),
        },
      );
      const j = (await r.json()) as { messages?: { id: string }[]; error?: { message: string } };
      return r.ok
        ? { status: "sent", provider: "whatsapp", ref: j.messages?.[0]?.id }
        : { status: "failed", provider: "whatsapp", error: j.error?.message };
    }
  } catch (e) {
    return { status: "failed", provider: m.channel, error: String(e) };
  }
  // Aucun prestataire : en production, pas de coordonnées ni de contenu dans les journaux (le message
  // reste consultable dans la table notifications).
  if (process.env.NODE_ENV === "production")
    console.info(`[notification non envoyée] ${m.channel} ${m.template}`);
  else console.info(`[notification factice] ${m.channel} → ${m.to} : ${m.text}`);
  return { status: "skipped", provider: "fake" };
}

export async function notify(messages: Message[]) {
  const db = createAdminClient();
  for (const m of messages) {
    const r = await deliver(m);
    await db.from("notifications").insert({
      profile_id: m.profileId ?? null,
      channel: m.channel,
      template: m.template,
      recipient: m.to,
      payload: { subject: m.subject ?? null, text: m.text },
      status: r.status,
      provider: r.provider,
      provider_ref: r.ref ?? null,
      error: r.error ?? null,
      sent_at: r.status === "sent" ? new Date().toISOString() : null,
    });
  }
}

/**
 * Notification d'une personne selon ses préférences (e-mail, SMS, WhatsApp). WhatsApp n'est
 * utilisé que si la fonctionnalité est activée. Un mineur sans coordonnées est prévenu via son
 * responsable légal.
 */
export async function notifyProfile(
  profileId: string,
  msg: {
    template: string;
    subject: string;
    text: string;
    whatsappTemplate?: { name: string; params: string[] };
  },
) {
  const db = createAdminClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, phone, email, notification_prefs, guardian_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!p) return;
  let contact = { phone: p.phone, email: p.email };
  if (!contact.phone && !contact.email && p.guardian_id) {
    const { data: g } = await db
      .from("profiles")
      .select("phone, email")
      .eq("id", p.guardian_id)
      .maybeSingle();
    if (g) contact = g;
  }
  const prefs = {
    email: true,
    sms: true,
    whatsapp: false,
    ...((p.notification_prefs ?? {}) as Record<string, boolean>),
  };
  const { data: flag } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", "whatsapp_notifications")
    .maybeSingle();
  const out: Message[] = [];
  const base = { profileId: p.id, template: msg.template, text: msg.text };
  if (contact.email && prefs.email)
    out.push({ ...base, channel: "email", to: contact.email, subject: msg.subject });
  if (contact.phone && prefs.whatsapp && flag?.enabled)
    out.push({
      ...base,
      channel: "whatsapp",
      to: contact.phone,
      whatsappTemplate: msg.whatsappTemplate,
    });
  else if (contact.phone && prefs.sms) out.push({ ...base, channel: "sms", to: contact.phone });
  if (out.length) await notify(out);
}
