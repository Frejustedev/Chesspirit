import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import {
  AmbassadorDecision,
  CategoryAdd,
  DeleteAwardItem,
  EditionForm,
  EditionStatus,
  NomineeAdd,
  PlanForm,
  PvmCreate,
} from "@/components/admin/community-admin";

export const metadata: Metadata = {
  title: "Administration — communauté",
  robots: { index: false },
};

const TABS = ["adhesions", "ambassadeurs", "awards", "public-contre-le-maitre"] as const;

export default async function AdminCommunity({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/communaute");
  if (!admin) redirect({ href: "/admin", locale });
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.onglet ?? "") ? sp.onglet! : "adhesions";
  const t = await getTranslations("adminCommunity");
  const supabase = await createClient();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("tabs")} className="mt-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin/communaute?onglet=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${tab === k ? "bg-ink text-cream" : "border border-line hover:bg-cream"}`}
          >
            {t(`tab.${k}`)}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {tab === "adhesions" ? (
          <Memberships locale={locale} />
        ) : tab === "ambassadeurs" ? (
          <Ambassadors locale={locale} />
        ) : tab === "awards" ? (
          <Awards locale={locale} />
        ) : (
          <Pvm locale={locale} />
        )}
      </div>
    </div>
  );

  async function Memberships({ locale }: { locale: string }) {
    const [{ data: plans }, { data: members }, { count: referrals }] = await Promise.all([
      supabase.from("membership_plans").select("*").order("code"),
      supabase
        .from("memberships")
        .select(
          "id, card_number, plan, status, starts_on, ends_on, profiles(first_name, last_name)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("referrals").select("id", { count: "exact", head: true }),
    ]);
    return (
      <>
        <section className="space-y-6">
          {(plans ?? []).map((p) => (
            <div key={p.code} className="rounded-lg border border-line p-4">
              <h2 className="font-display text-xl font-semibold">{tr(p.name, locale)}</h2>
              <div className="mt-3">
                <PlanForm
                  code={p.code as "free" | "premium"}
                  price={p.price_xof}
                  duration={p.duration_months}
                  active={p.is_active}
                />
              </div>
            </div>
          ))}
        </section>
        <p className="mt-6">{t("referralsCount", { n: referrals ?? 0 })}</p>
        <h2 className="mt-8 font-display text-2xl font-semibold">{t("members")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">{t("card")}</th>
                <th className="py-2 pr-3">{t("name")}</th>
                <th className="py-2 pr-3">{t("plan")}</th>
                <th className="py-2 pr-3">{t("status")}</th>
                <th className="py-2">{t("validity")}</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-b border-line">
                  <td className="tabular py-2 pr-3">{m.card_number}</td>
                  <td className="py-2 pr-3">
                    {m.profiles?.first_name} {m.profiles?.last_name}
                  </td>
                  <td className="py-2 pr-3">{m.plan}</td>
                  <td className="py-2 pr-3">{t(`memberStatus.${m.status}`)}</td>
                  <td className="py-2">{m.ends_on ? formatDate(m.ends_on, locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  async function Ambassadors({ locale }: { locale: string }) {
    const { data: rows } = await supabase
      .from("ambassadors")
      .select(
        "profile_id, city, motivation, status, created_at, profiles(first_name, last_name, phone)",
      )
      .order("created_at", { ascending: false });
    return (
      <ul className="space-y-3">
        {(rows ?? []).map((a) => (
          <li key={a.profile_id} className="rounded-md border border-line p-3">
            <p className="font-semibold">
              {a.profiles?.first_name} {a.profiles?.last_name} · {a.city} ·{" "}
              <span className="text-stone">{formatDate(a.created_at, locale)}</span>
            </p>
            <p className="mt-1 text-sm">{a.motivation}</p>
            <div className="mt-2">
              {a.status === "pending" ? (
                <AmbassadorDecision profileId={a.profile_id} />
              ) : (
                <span className="text-sm font-semibold">{t(`ambassadorStatus.${a.status}`)}</span>
              )}
            </div>
          </li>
        ))}
        {!rows?.length ? <li className="text-stone">{t("noAmbassadors")}</li> : null}
      </ul>
    );
  }

  async function Awards({ locale }: { locale: string }) {
    const { data: editions } = await supabase
      .from("award_editions")
      .select("*, award_categories(id, name, position, award_nominees(id, name))")
      .order("year", { ascending: false });
    return (
      <>
        <section className="rounded-lg border border-line p-4">
          <h2 className="font-display text-xl font-semibold">{t("newEdition")}</h2>
          <div className="mt-3">
            <EditionForm />
          </div>
        </section>
        {(editions ?? []).map((e) => (
          <section key={e.id} className="mt-8 rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold">
                {tr(e.title, locale)}
                {e.is_demo ? (
                  <span className="ml-2 text-sm text-bordeaux">({t("demo")})</span>
                ) : null}
              </h2>
              <EditionStatus id={e.id} status={e.status} />
            </div>
            <ul className="mt-4 space-y-4">
              {[...e.award_categories]
                .sort((a, b) => a.position - b.position)
                .map((c) => (
                  <li key={c.id} className="rounded-md bg-cream/60 p-3">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 font-semibold">{tr(c.name, locale)}</h3>
                      <DeleteAwardItem kind="category" id={c.id} label={tr(c.name, locale)} />
                    </div>
                    <ul className="mt-2">
                      {c.award_nominees.map((n) => (
                        <li key={n.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">{n.name}</span>
                          <DeleteAwardItem kind="nominee" id={n.id} label={n.name} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <NomineeAdd categoryId={c.id} />
                    </div>
                  </li>
                ))}
            </ul>
            <div className="mt-4">
              <CategoryAdd editionId={e.id} />
            </div>
          </section>
        ))}
      </>
    );
  }

  async function Pvm({ locale }: { locale: string }) {
    const { data: games } = await supabase
      .from("pvm_games")
      .select("id, slug, title, master_name, status, moves, is_demo")
      .order("created_at", { ascending: false });
    return (
      <>
        <section className="rounded-lg border border-line p-4">
          <h2 className="font-display text-xl font-semibold">{t("newPvm")}</h2>
          <p className="mt-1 text-sm text-stone">{t("pvmHelp")}</p>
          <div className="mt-3">
            <PvmCreate />
          </div>
        </section>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {(games ?? []).map((g) => (
            <li key={g.id} className="flex flex-wrap gap-3 py-3">
              <Link
                href={`/communaute/public-contre-le-maitre/${g.slug}`}
                className="font-semibold hover:text-bordeaux"
              >
                {tr(g.title, locale)}
              </Link>
              <span className="text-sm text-stone">
                {g.master_name} · {g.moves.length} · {t(`pvmStatus.${g.status}`)}
                {g.is_demo ? ` · ${t("demo")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }
}
