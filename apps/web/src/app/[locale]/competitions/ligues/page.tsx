import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import {
  DIVISIONS,
  LEAGUE_CADENCES,
  getSeasonLeagues,
  getSeasons,
  pickSeason,
  type LeagueRules,
} from "@/lib/data/leagues";
import { tr } from "@/lib/i18n-json";
import { SeasonPicker } from "@/components/competitions/season-picker";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Tbc } from "@/components/ui/tbc";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leagues");
  return { title: t("title"), description: t("intro") };
}

export default async function LeaguesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saison?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { saison } = await searchParams;
  const t = await getTranslations("leagues");
  const [season, seasons] = await Promise.all([pickSeason(saison), getSeasons()]);
  const leagues = season ? await getSeasonLeagues(season.id) : [];
  const rules = (season?.league_rules ?? {}) as LeagueRules;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-3xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <SeasonPicker
          base="/competitions/ligues"
          seasons={seasons}
          current={season?.slug ?? ""}
          label={t("seasons")}
        />
      </div>
      {season ? (
        <>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-stone">
            <span className="font-semibold text-ink">{season.name}</span>
            {season.is_demo ? <DemoBadge /> : null}· {formatDate(season.starts_on, locale)} →{" "}
            {formatDate(season.ends_on, locale)} · {t(`seasonStatus.${season.status}`)}
          </p>
          {!season.is_demo && season.status === "planned" ? (
            <p className="mt-3 rounded bg-gold-soft/60 px-4 py-3">{t("plannedNote")}</p>
          ) : null}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="sr-only">{t("division.label")}</th>
                  {LEAGUE_CADENCES.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="text-left font-display text-xl font-semibold"
                    >
                      {t(`cadence.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIVISIONS.map((d) => (
                  <tr key={d}>
                    <th
                      scope="row"
                      className="w-32 text-left align-top font-display text-xl font-semibold"
                    >
                      {t(`division.${d}`)}
                    </th>
                    {LEAGUE_CADENCES.map((c) => {
                      const l = leagues.find((x) => x.division === d && x.cadence === c);
                      if (!l) return <td key={c} />;
                      return (
                        <td key={c} className="align-top">
                          <Link
                            href={`/competitions/ligues/${l.slug}`}
                            className="block h-full rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
                          >
                            <span className="tabular block text-sm font-semibold">
                              {l.base_minutes} min + {l.increment_seconds} s
                            </span>
                            <span className="block text-sm text-stone">
                              {t(`format.${l.format}`)}
                              {l.rounds_count ? ` · ${t("rounds", { n: l.rounds_count })}` : ""}
                            </span>
                            <span className="block text-sm text-stone">
                              {tr(l.schedule_note, locale)}
                            </span>
                            <span className="mt-2 block text-sm">
                              {l.leader
                                ? t("leader", {
                                    name: l.leader.display_name ?? "",
                                    pts: Number(l.leader.points),
                                  })
                                : t("members", { n: l.membersCount })}
                            </span>
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-semibold">{t("rulesTitle")}</h2>
              <ul className="mt-3 space-y-2">
                <li>{t("rulePoints")}</li>
                <li>
                  {t("ruleMoves", {
                    up: rules.promoted ?? 2,
                    down: rules.relegated ?? 2,
                    upper: rules.playoff?.upper_rank ?? 10,
                    lower: rules.playoff?.lower_rank ?? 3,
                  })}
                </li>
                <li>{rules.sofia_rule ? t("sofiaOn") : t("sofiaOff")}</li>
                <li>{t("rulePostpone", { days: rules.postpone_deadline_days ?? 7 })}</li>
                <li>{t("ruleForfeits", { n: rules.max_unjustified_forfeits ?? 2 })}</li>
                <li>{t("ruleFirstSeason")}</li>
                <li>{t("ruleTitles")}</li>
              </ul>
            </div>
            <div className="rounded-lg bg-ink p-6 text-cream">
              <h2 className="font-display text-2xl font-semibold">{t("licenseTitle")}</h2>
              <p className="mt-2 text-cream/80">{t("licenseText")}</p>
              <p className="mt-4 font-display text-3xl font-semibold">
                {season.license_fee_xof === null ? (
                  <Tbc />
                ) : season.license_fee_xof === 0 ? (
                  t("free")
                ) : (
                  formatXof(season.license_fee_xof, locale)
                )}
              </p>
              <Link
                href="/compte/ligues"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-gold px-5 font-semibold text-ink hover:bg-cream"
              >
                {t("licenseCta")}
              </Link>
            </div>
          </section>
        </>
      ) : (
        <p className="mt-8 text-stone">{t("noSeason")}</p>
      )}
    </div>
  );
}
