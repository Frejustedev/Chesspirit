import "server-only";
import { formatXof } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

/** Confirmation de commande payée (SMS et e-mail, factices sans clé). Cartes cadeaux incluses. */
export async function orderConfirmation(orderId: string) {
  const db = createAdminClient();
  const { data: o } = await db
    .from("orders")
    .select("id, number, status, total_xof, contact_phone, contact_email, profile_id")
    .eq("id", orderId)
    .single();
  if (!o || o.status === "pending_payment" || o.status === "cancelled") return;
  const { data: cards } = await db
    .from("gift_cards")
    .select("code, initial_xof")
    .eq("purchase_order_id", o.id);
  const codes = (cards ?? []).map((c) => `${c.code} (${formatXof(c.initial_xof)})`).join(", ");
  const text =
    `Chesspirit : commande ${o.number} confirmée (${formatXof(o.total_xof)}). Suivi : chesspirit.com/boutique/suivi` +
    (codes ? ` — cartes cadeaux : ${codes}` : "");
  await notify([
    {
      profileId: o.profile_id,
      channel: "sms" as const,
      to: o.contact_phone,
      template: "order_confirmed",
      text,
    },
    ...(o.contact_email
      ? [
          {
            profileId: o.profile_id,
            channel: "email" as const,
            to: o.contact_email,
            template: "order_confirmed",
            subject: `Commande ${o.number} confirmée`,
            text,
          },
        ]
      : []),
  ]).catch(() => undefined);
}
