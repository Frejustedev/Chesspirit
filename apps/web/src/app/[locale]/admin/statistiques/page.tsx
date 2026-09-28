import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Bars } from "@/components/admin/bars";

export const metadata: Metadata = {
  title: "Administration — statistiques",
  robots: { index: false },
};

type Stats = {
  users: {
    total: number;
    accounts: number;
    new: number;
    active: number;
    by_department: Record<string, number>;
    by_sex: Record<string, number>;
    by_age: Record<string, number>;
    by_city: Record<string, number>;
  };
  competitions: {
    tournaments: number;
    registrations: number;
    players: number;
    games: number;
    by_month: Record<string, number>;
  };
  finance: {
    revenue: number;
    refunds: number;
    failed: number;
    by_object: Record<string, number>;
    by_month: Record<string, number>;
  };
  coaching: { bookings: number; commission: number };
  shop: { orders: number; top_products: { name: string; qty: number }[] };
  content: { puzzle_attempts: number; puzzle_solvers: number; articles: number; episodes: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminStats({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ du?: string; au?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/statistiques");
  if (!admin) redirect({ href: "/admin", locale });
  const sp = await searchParams;
  const now = new Date();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.du ?? "")
    ? sp.du!
    : iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.au ?? "") ? sp.au! : iso(now);
  const t = await getTranslations("adminStats");
  const tp = await getTranslations("adminPayments");
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_stats", { p_from: from, p_to: to });
  const s = data as unknown as Stats;
  const money = (n: number) => formatXof(n, locale);
  const kpi = (label: string, value: string | number) => (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <dt className="text-sm text-stone">{label}</dt>
      <dd className="tabular mt-1 font-display text-3xl font-semibold">{value}</dd>
    </div>
  );
  const csv = `/api/admin/stats?${new URLSearchParams({ du: from, au: to })}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        <a
          href={csv}
          className="inline-flex min-h-11 items-center rounded-full border border-ink/25 px-4 font-semibold hover:bg-cream"
        >
          {t("export")}
        </a>
      </div>
      <form action="/admin/statistiques" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="s-du" className="block text-sm font-semibold">
            {t("from")}
          </label>
          <input
            id="s-du"
            name="du"
            type="date"
            defaultValue={from}
            className="mt-1 min-h-11 rounded-md border border-line bg-white px-3"
          />
        </div>
        <div>
          <label htmlFor="s-au" className="block text-sm font-semibold">
            {t("to")}
          </label>
          <input
            id="s-au"
            name="au"
            type="date"
            defaultValue={to}
            className="mt-1 min-h-11 rounded-md border border-line bg-white px-3"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {t("apply")}
        </button>
      </form>
      {s ? (
        <>
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">{t("users")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpi(t("totalProfiles"), s.users.total)}
              {kpi(t("accounts"), s.users.accounts)}
              {kpi(t("newProfiles"), s.users.new)}
              {kpi(t("active"), s.users.active)}
            </dl>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold">{t("byDepartment")}</h3>
                <Bars data={s.users.by_department} label={t("byDepartment")} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("byCity")}</h3>
                <Bars data={s.users.by_city} label={t("byCity")} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("byAge")}</h3>
                <Bars data={s.users.by_age} label={t("byAge")} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("bySex")}</h3>
                <Bars data={s.users.by_sex} label={t("bySex")} />
              </div>
            </div>
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("competitions")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpi(t("tournaments"), s.competitions.tournaments)}
              {kpi(t("registrations"), s.competitions.registrations)}
              {kpi(t("players"), s.competitions.players)}
              {kpi(t("games"), s.competitions.games)}
            </dl>
            <div className="mt-6 max-w-xl">
              <Bars data={s.competitions.by_month} label={t("tournamentsByMonth")} />
            </div>
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("finance")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpi(t("revenue"), money(s.finance.revenue))}
              {kpi(t("refunds"), money(s.finance.refunds))}
              {kpi(t("failed"), s.finance.failed)}
              {kpi(t("commission"), money(s.coaching.commission))}
            </dl>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold">{t("byMonth")}</h3>
                <Bars data={s.finance.by_month} format={money} label={t("byMonth")} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("byObject")}</h3>
                <Bars
                  data={Object.fromEntries(
                    Object.entries(s.finance.by_object).map(([k, v]) => [tp(`types.${k}`), v]),
                  )}
                  format={money}
                  label={t("byObject")}
                />
              </div>
            </div>
          </section>
          <section className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-semibold">{t("activity")}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {kpi(t("bookings"), s.coaching.bookings)}
                {kpi(t("orders"), s.shop.orders)}
                {kpi(t("puzzleSolvers"), s.content.puzzle_solvers)}
                {kpi(t("published"), s.content.articles + s.content.episodes)}
              </dl>
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold">{t("topProducts")}</h2>
              <Bars
                data={Object.fromEntries(s.shop.top_products.map((p) => [p.name, p.qty]))}
                label={t("topProducts")}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
