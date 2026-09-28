import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { OrderTimeline } from "@/components/shop/order-timeline";
import { OrderActions } from "@/components/shop/order-actions";
import { OrderSummary } from "@/components/shop/order-summary";

export const metadata: Metadata = { robots: { index: false } };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  if (!/^CS-\d{4}-\d{3,}$/.test(number)) notFound();
  const session = await requireSession(locale, `/compte/commandes/${number}`);
  const t = await getTranslations("shop");
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*), order_events(status, note, created_at)")
    .eq("number", number)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!o) notFound();
  const { data: cards } = await supabase
    .from("gift_cards")
    .select("code, initial_xof, recipient_name")
    .eq("purchase_order_id", o.id);
  return (
    <AccountShell
      nav={<AccountNav current="/compte/commandes" isAdmin={isAdminRole(session.roles)} />}
      title={`${t("order")} ${o.number}`}
    >
      <p className="text-stone">
        {formatDateTime(o.created_at, locale)} · {t(`deliveryKind.${o.delivery_method}`)}
      </p>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_16rem]">
        <OrderSummary order={o} locale={locale} />
        <div>
          <OrderTimeline
            delivery={o.delivery_method}
            status={o.status}
            events={o.order_events.map((e) => ({
              status: e.status,
              note: e.note,
              at: e.created_at,
            }))}
            locale={locale}
          />
          {o.tracking_note ? <p className="mt-4 text-sm">{o.tracking_note}</p> : null}
        </div>
      </div>
      {cards?.length ? (
        <section className="mt-8 rounded-lg bg-gold-soft/50 p-5">
          <h2 className="font-display text-2xl font-semibold">{t("yourGiftCards")}</h2>
          <ul className="mt-2 space-y-1">
            {cards.map((c) => (
              <li key={c.code}>
                <span className="font-mono font-semibold">{c.code}</span> ·{" "}
                {formatXof(c.initial_xof, locale)}
                {c.recipient_name ? ` · ${c.recipient_name}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {o.status === "pending_payment" ? (
        <div className="mt-8">
          <OrderActions orderId={o.id} />
        </div>
      ) : null}
    </AccountShell>
  );
}
