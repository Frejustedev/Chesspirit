import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { DemoBadge } from "@/components/ui/demo-badge";
import { RankingTabs } from "@/components/rankings/ranking-tabs";
import { FIDE_CADENCES, getFideRanking, type FideCadence } from "@/lib/data/fide";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fide");
  return { title: t("title"), description: t("intro") };
}

/** Elo FIDE officiel des joueurs (profils publics avec identifiant FIDE), importé chaque mois. */
export default async function FidePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cadence?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { cadence: raw } = await searchParams;
  const cadence: FideCadence = (FIDE_CADENCES as readonly string[]).includes(raw ?? "")
    ? (raw as FideCadence)
    : "standard";
  const t = await getTranslations("fide");
  const { rows, period } = await getFideRanking(cadence);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <RankingTabs current="fide" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      {period ? (
        <p className="mt-2 text-sm text-stone">
          {t("period", { period: formatDate(period, locale, { month: "long", year: "numeric" }) })}
        </p>
      ) : null}
      <nav aria-label={t("cadences")} className="mt-6 flex flex-wrap gap-2">
        {FIDE_CADENCES.map((c) => (
          <Link
            key={c}
            href={c === "standard" ? "/classements/fide" : `/classements/fide?cadence=${c}`}
            aria-current={c === cadence ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${c === cadence ? "border-bordeaux bg-bordeaux text-cream" : "border-line hover:border-accent"}`}
          >
            {t(c)}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[36rem] text-left text-[0.95rem]">
              <thead className="bg-surface/70 text-xs uppercase tracking-[0.08em] text-stone">
                <tr>
                  <th className="px-3 py-2">{t("rank")}</th>
                  <th className="px-3 py-2">{t("player")}</th>
                  <th className="px-3 py-2">{t("titleCol")}</th>
                  <th className="px-3 py-2">FIDE ID</th>
                  {FIDE_CADENCES.map((c) => (
                    <th
                      key={c}
                      className={`px-3 py-2 text-right ${c === cadence ? "text-accent" : ""}`}
                    >
                      {t(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular px-3 py-2 font-display text-lg text-accent">{r.rank}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/joueurs/${r.id}`} className="hover:text-accent">
                        {r.displayName}
                      </Link>{" "}
                      {r.isDemo ? <DemoBadge /> : null}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-accent">
                      {r.titles.join(", ")}
                    </td>
                    <td className="tabular px-3 py-2 text-stone">{r.fideId}</td>
                    {FIDE_CADENCES.map((c) => (
                      <td
                        key={c}
                        className={`tabular px-3 py-2 text-right ${c === cadence ? "font-semibold" : "text-stone"}`}
                      >
                        {r[c] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-stone">{t("unrated")}</p>
        </>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line p-6 font-serif text-lg text-stone">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
