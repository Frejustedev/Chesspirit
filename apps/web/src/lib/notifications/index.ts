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
}

async function deliver(m: Message): Promise<{ status: "sent" | "skipped" | "failed"; provider: string; ref?: string; error?: string }> {
  try {
    if (m.channel === "email" && process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Chesspirit <no-reply@chesspirit.com>", to: m.to, subject: m.subject ?? "Chesspirit", text: m.text }),
      });
      const j = (await r.json()) as { id?: string; message?: string };
      return r.ok ? { status: "sent", provider: "resend", ref: j.id } : { status: "failed", provider: "resend", error: j.message };
    }
    if (m.channel === "sms" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
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
      return r.ok ? { status: "sent", provider: "twilio", ref: j.sid } : { status: "failed", provider: "twilio", error: j.message };
    }
    if (m.channel === "whatsapp" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: m.to.replace(/^\+/, ""), type: "text", text: { body: m.text } }),
      });
      const j = (await r.json()) as { messages?: { id: string }[]; error?: { message: string } };
      return r.ok ? { status: "sent", provider: "whatsapp", ref: j.messages?.[0]?.id } : { status: "failed", provider: "whatsapp", error: j.error?.message };
    }
  } catch (e) {
    return { status: "failed", provider: m.channel, error: String(e) };
  }
  console.info(`[notification factice] ${m.channel} → ${m.to} : ${m.text}`);
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
