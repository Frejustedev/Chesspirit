import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { ShopAdminNav } from "@/components/admin/shop-admin";

export const metadata: Metadata = { title: "Administration — boutique", robots: { index: false } };

const FILTERS = ["todo", "pending_payment", "shipped", "done", "cancelled", "all"] as const;

export default async function AdminShop({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/boutique");
  if (!admin) redirect({ href: "/admin", locale });
  const { filtre } = await searchParams;
  const f = (FILTERS as readonly string[]).includes(filtre ?? "") ? filtre! : "todo";
  const t = await getTranslations("adminShop");
  const ts = await getTranslations("shop");
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select(
      "id, number, status, total_xof, delivery_method, contact_name, created_at, has_preorder",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (f === "todo") q = q.in("status", ["paid", "preparing", "ready_for_pickup"]);
  else if (f === "pending_payment") q = q.eq("status", "pending_payment");
  else if (f === "shipped") q = q.eq("status", "shipped");
  else if (f === "done") q = q.eq("status", "delivered");
  else if (f === "cancelled") q = q.in("status", ["cancelled", "refunded"]);
  const [{ data: orders }, { data: overview }] = await Promise.all([
    q,
    supabase.rpc("shop_overview").maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <ShopAdminNav current="/admin/boutique" />
      {overview ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ["toProcess", overview.orders_to_process],
              ["revenue", formatXof(Number(overview.revenue_xof), locale)],
              ["lowStock", overview.low_stock],
              ["pendingPayment", overview.pending_payment],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-card)] border border-line p-4">
              <dt className="text-sm text-stone">{t(`stats.${k}`)}</dt>
              <dd className="tabular mt-1 font-display text-3xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <nav aria-label={t("filters")} className="-mx-4 mt-8 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTERS.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/boutique?filtre=${k}`}
                aria-current={f === k ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${f === k ? "bg-gold text-onaccent" : "border border-line hover:bg-surface"}`}
              >
                {t(`filter.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {orders?.length ? (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/boutique/commandes/${o.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="tabular font-semibold group-hover:text-accent">{o.number}</span>
                <span className="min-w-0 flex-1 truncate">{o.contact_name}</span>
                <span className="text-sm text-stone">{formatDateTime(o.created_at, locale)}</span>
                <span className="text-sm">{ts(`deliveryKind.${o.delivery_method}`)}</span>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold">
                  {ts(`status.${o.status}`)}
                  {o.has_preorder ? ` · ${ts("preorder")}` : ""}
                </span>
                <span className="tabular font-semibold">{formatXof(o.total_xof, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-stone">{t("noOrders")}</p>
      )}
    </div>
  );
}
