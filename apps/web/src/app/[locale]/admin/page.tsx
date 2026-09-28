import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { IconArrow, IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin");
  const t = await getTranslations("admin");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [{ data: tournaments }, overview, { data: alerts }] = await Promise.all([
    supabase.rpc("my_managed_tournaments"),
    admin ? supabase.rpc("admin_overview").maybeSingle() : Promise.resolve({ data: null }),
    admin ? supabase.rpc("admin_alerts") : Promise.resolve({ data: [] }),
  ]);
  const o = overview.data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <p className="font-sans text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">
        {t("kicker")}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold">{t("title")}</h1>
      {o ? (
        <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ["users", o.users],
              ["registrations", o.registrations],
              ["revenue", formatXof(Number(o.revenue_xof), locale)],
              ["requests", `${o.pending_data_requests} · ${o.contact_new}`],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-card)] border border-line p-4">
              <dt className="text-sm text-stone">{t(`stats.${k}`)}</dt>
              <dd className="tabular mt-1 font-display text-3xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {alerts?.length ? (
        <section className="mt-6 rounded-lg border border-bordeaux/40 bg-bordeaux-soft/40 p-4">
          <h2 className="font-semibold text-bordeaux">{t("alerts.title")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={a.kind}>
                <span className="font-semibold">{t(`alerts.${a.kind}`)}</span> : {Number(a.count)}
                {a.detail ? ` — ${a.detail}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">{t("tournaments")}</h2>
          {admin ? (
            <Link
              href="/admin/tournois/nouveau"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bordeaux px-4 font-semibold text-cream hover:bg-ink"
            >
              <IconPlus className="size-5" /> {t("newTournament")}
            </Link>
          ) : null}
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(tournaments ?? []).map((tn) => (
            <li key={tn.id}>
              <Link
                href={`/admin/tournois/${tn.id}`}
                className="group flex items-center gap-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold group-hover:text-bordeaux">{tn.name}</span>
                  <span className="block text-sm text-stone">
                    {formatDate(tn.starts_at, locale)} · {tt(`status.${tn.status}`)}
                    {tn.is_demo ? " · démo" : ""}
                  </span>
                </span>
                <IconArrow className="size-5 text-stone group-hover:text-bordeaux" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
