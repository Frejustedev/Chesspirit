import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { RefundButton } from "@/components/admin/misc-admin";

export const metadata: Metadata = { title: "Administration — paiements", robots: { index: false } };

const STATUSES = ["pending", "succeeded", "failed", "cancelled", "refunded"] as const;
const TYPES = ["registration", "order", "booking"] as const;

export default async function AdminPayments({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ statut?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/paiements");
  if (!admin) redirect({ href: "/admin", locale });
  const sp = await searchParams;
  const statut = (STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "";
  const type = (TYPES as readonly string[]).includes(sp.type ?? "") ? sp.type! : "";
  const t = await getTranslations("adminPayments");
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "id, provider, status, amount_xof, object_type, object_id, description, provider_ref, created_at, confirmed_at, metadata, refunds(amount_xof, status)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (statut) q = q.eq("status", statut);
  if (type) q = q.eq("object_type", type);
  const { data: payments } = await q;
  const total = (payments ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount_xof, 0);
  const csv = `/api/admin/payments?${new URLSearchParams({ ...(statut ? { statut } : {}), ...(type ? { type } : {}) })}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        <a
          href={csv}
          className="inline-flex min-h-11 items-center rounded-full border border-fg/25 px-4 font-semibold hover:bg-surface"
        >
          {t("export")}
        </a>
      </div>
      <form action="/admin/paiements" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="p-status" className="sr-only">
          {t("status")}
        </label>
        <select
          id="p-status"
          name="statut"
          defaultValue={statut}
          className="min-h-11 rounded-md border border-line bg-field px-3"
        >
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
        <label htmlFor="p-type" className="sr-only">
          {t("type")}
        </label>
        <select
          id="p-type"
          name="type"
          defaultValue={type}
          className="min-h-11 rounded-md border border-line bg-field px-3"
        >
          <option value="">{t("allTypes")}</option>
          {TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`types.${s}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
        >
          {t("apply")}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone">
        {t("summary", { n: payments?.length ?? 0, total: formatXof(total, locale) })}
      </p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {(payments ?? []).map((p) => {
          const refunded = p.refunds
            .filter((r) => r.status !== "failed")
            .reduce((s, r) => s + r.amount_xof, 0);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
              <span className="tabular w-36 text-stone">
                {formatDateTime(p.created_at, locale)}
              </span>
              <span className="min-w-0 flex-1">
                {p.object_type === "order" ? (
                  <Link href={`/admin/boutique/commandes/${p.object_id}`} className="underline">
                    {p.description ?? t("types.order")}
                  </Link>
                ) : (
                  (p.description ?? t(`types.${p.object_type}`))
                )}
              </span>
              <span>{p.provider}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">
                {t(`statuses.${p.status}`)}
              </span>
              <span className="tabular font-semibold">{formatXof(p.amount_xof, locale)}</span>
              {(p.metadata as { needs_refund?: boolean } | null)?.needs_refund && !refunded ? (
                <span className="rounded-full bg-bordeaux px-2 py-0.5 text-xs font-semibold text-cream">
                  {t("needsRefund")}
                </span>
              ) : null}
              {refunded ? (
                <span className="tabular text-accent">−{formatXof(refunded, locale)}</span>
              ) : null}
              {p.status === "succeeded" && refunded < p.amount_xof ? (
                <RefundButton paymentId={p.id} max={p.amount_xof - refunded} />
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-stone">{t("refundNote")}</p>
    </div>
  );
}
