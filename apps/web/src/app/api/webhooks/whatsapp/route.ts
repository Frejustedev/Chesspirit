import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { assistantReply } from "@/lib/whatsapp-assistant";
import { safeEqual, validSignature } from "@/lib/whatsapp-signature";

const MAX_BODY = 262_144;
const MAX_REPLIES_PER_HOUR = 20;

/** Vérification de l'abonnement au webhook (WhatsApp Cloud API). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (
    token &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    safeEqual(url.searchParams.get("hub.verify_token") ?? "", token) &&
    /^[A-Za-z0-9_-]{1,128}$/.test(challenge)
  )
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  return new Response("forbidden", { status: 403 });
}

type WaPayload = {
  entry?: {
    changes?: {
      value?: {
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
};

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"), secret))
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const db = createAdminClient();
  const { data: flag } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", "whatsapp_assistant")
    .maybeSingle();
  // Désactivé : accusé de réception seulement (Meta ne renvoie pas le message).
  if (!flag?.enabled) return NextResponse.json({ ok: true, ignored: true });

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw) as WaPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const messages = (payload.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .flatMap((c) => c.value?.messages ?? [])
    .filter((m) => m.id && m.from && /^[0-9]{6,15}$/.test(m.from))
    .slice(0, 20);
  let replied = 0;
  for (const m of messages) {
    const body = m.type === "text" ? (m.text?.body ?? "").slice(0, 4096) : "";
    // Déduplication : Meta peut renvoyer le même message plusieurs fois.
    const { data: row, error } = await db
      .from("whatsapp_inbound")
      .insert({ message_id: m.id!.slice(0, 200), wa_from: m.from!, body })
      .select("id")
      .single();
    if (error || !row) continue;
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db
      .from("whatsapp_inbound")
      .select("id", { count: "exact", head: true })
      .eq("wa_from", m.from!)
      .gte("created_at", since);
    if ((count ?? 0) > MAX_REPLIES_PER_HOUR) continue;
    const phone = `+${m.from}`;
    const { intent, reply } = await assistantReply(db, body, phone);
    await db.from("whatsapp_inbound").update({ intent: intent.kind }).eq("id", row.id);
    // Réponse dans la fenêtre de 24 h (texte libre) ; sans jeton WhatsApp, rien n'est envoyé (mode factice).
    await notify([
      { channel: "whatsapp", to: phone, template: `assistant_${intent.kind}`, text: reply },
    ]);
    replied++;
  }
  return NextResponse.json({ ok: true, replied });
}
