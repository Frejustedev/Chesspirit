import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AccountNav, AccountShell } from "@/components/account/account-nav";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyOrders({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/commandes");
  const t = await getTranslations("shop");
  const supabase = await createClient();
  const [{ data: orders }, { data: points }, { data: wishlist }, { data: cards }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, number, status, total_xof, created_at, order_items(quantity)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.rpc("loyalty_balance"),
      supabase
        .from("wishlists")
        .select("product_id, products(slug, name, price_xof)")
        .eq("profile_id", session.profile!.id),
      supabase
        .from("gift_cards")
        .select("id, code, initial_xof, balance_xof, status, recipient_name, expires_at"),
    ]);
  return (
    <AccountShell
      nav={<AccountNav current="/compte/commandes" isAdmin={isAdminRole(session.roles)} />}
      title={t("myOrders")}
    >
      <p className="rounded-lg bg-surface px-4 py-3">
        <span className="font-semibold">{t("loyalty")}</span> :{" "}
        <span className="tabular">{t("pointsN", { n: points ?? 0 })}</span>
      </p>
      <section className="mt-8">
        {orders?.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/compte/commandes/${o.number}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="tabular font-semibold group-hover:text-accent">{o.number}</span>
                  <span className="text-sm text-stone">{formatDate(o.created_at, locale)}</span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold">
                    {t(`status.${o.status}`)}
                  </span>
                  <span className="tabular ml-auto font-semibold">
                    {formatXof(o.total_xof, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone">
            {t("noOrders")}{" "}
            <Link href="/boutique" className="font-semibold text-accent hover:underline">
              {t("continue")}
            </Link>
          </p>
        )}
      </section>
      {cards?.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("myGiftCards")}</h2>
          <ul className="mt-3 space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="rounded-md border border-line px-4 py-3">
                <span className="tabular font-mono font-semibold">{c.code}</span> ·{" "}
                {formatXof(c.balance_xof, locale)} / {formatXof(c.initial_xof, locale)}
                {c.recipient_name ? ` · ${c.recipient_name}` : ""}
                {c.expires_at
                  ? ` · ${t("expires", { date: formatDate(c.expires_at, locale) })}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("wishlist")}</h2>
        {wishlist?.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {wishlist.map((w) =>
              w.products ? (
                <li key={w.product_id} className="flex justify-between gap-3 py-3">
                  <Link
                    href={`/boutique/produit/${w.products.slug}`}
                    className="font-semibold hover:text-accent"
                  >
                    {tr(w.products.name, locale)}
                  </Link>
                  <span className="tabular">{formatXof(w.products.price_xof, locale)}</span>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="mt-2 text-stone">{t("wishlistEmpty")}</p>
        )}
      </section>
    </AccountShell>
  );
}
