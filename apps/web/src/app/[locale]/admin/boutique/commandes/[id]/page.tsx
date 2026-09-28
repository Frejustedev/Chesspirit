import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { OrderSummary } from "@/components/shop/order-summary";
import { OrderTimeline } from "@/components/shop/order-timeline";
import { OrderStatusForm } from "@/components/admin/shop-admin";

export const metadata: Metadata = { title: "Administration — commande", robots: { index: false } };

export default async function AdminOrder({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { admin } = await requireStaff(locale, `/admin/boutique/commandes/${id}`);
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminShop");
  const ts = await getTranslations("shop");
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*), order_events(status, note, created_at), promo_codes(code)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const [{ data: payments }, { data: cards }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, provider, status, amount_xof, created_at, provider_ref")
      .eq("object_type", "order")
      .eq("object_id", o.id)
      .order("created_at"),
    supabase
      .from("gift_cards")
      .select("code, initial_xof, balance_xof, status")
      .eq("purchase_order_id", o.id),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <Link href="/admin/boutique" className="text-sm font-semibold text-bordeaux hover:underline">
        ← {t("title")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {ts("order")} {o.number}
      </h1>
      <p className="text-stone">
        {formatDateTime(o.created_at, locale)} · {ts(`deliveryKind.${o.delivery_method}`)} ·{" "}
        {ts(`status.${o.status}`)}
        {o.promo_codes ? ` · ${o.promo_codes.code}` : ""}
      </p>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_18rem]">
        <div>
          <OrderSummary order={o} locale={locale} />
          <h2 className="mt-8 font-display text-2xl font-semibold">{t("payments")}</h2>
          <ul className="mt-2 text-sm">
            {(payments ?? []).map((p) => (
              <li key={p.id}>
                {formatDateTime(p.created_at, locale)} · {p.provider} · {p.status} · {p.amount_xof}{" "}
                F CFA
                {p.provider_ref ? ` · ${p.provider_ref}` : ""}
              </li>
            ))}
          </ul>
          {cards?.length ? (
            <>
              <h2 className="mt-6 font-display text-2xl font-semibold">{ts("myGiftCards")}</h2>
              <ul className="mt-2 text-sm">
                {cards.map((c) => (
                  <li key={c.code} className="font-mono">
                    {c.code} · {c.balance_xof}/{c.initial_xof} · {c.status}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className="space-y-6">
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
          <OrderStatusForm orderId={o.id} status={o.status} delivery={o.delivery_method} />
        </div>
      </div>
    </div>
  );
}
