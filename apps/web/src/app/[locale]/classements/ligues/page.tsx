import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, LEAGUE_CADENCES, getSeasons, pickSeason } from "@/lib/data/leagues";
import { SeasonPicker } from "@/components/competitions/season-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leagues");
  return { title: t("rankingTitle") };
}

export default async function LeagueRankings({
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
  const supabase = await createClient();
  const { data: leagues } = season
    ? await supabase
        .from("leagues")
        .select("id, slug, division, cadence, champion_id")
        .eq("season_id", season.id)
    : { data: [] };
  const ids = (leagues ?? []).map((l) => l.id);
  const { data: top } = ids.length
    ? await supabase
        .from("league_standings")
        .select("league_id, player_id, display_name, points, rank")
        .in("league_id", ids)
        .lte("rank", 3)
        .order("rank")
    : { data: [] };
  // Triple Couronne : même champion en classique, rapide et blitz d'une division.
  const triple = DIVISIONS.flatMap((d) => {
    const champs = LEAGUE_CADENCES.map(
      (c) => (leagues ?? []).find((l) => l.division === d && l.cadence === c)?.champion_id,
    );
    return champs.every((x) => x && x === champs[0]) ? [{ division: d, id: champs[0]! }] : [];
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("rankingTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("rankingIntro")}</p>
      <div className="mt-6">
        <SeasonPicker
          base="/classements/ligues"
          seasons={seasons}
          current={season?.slug ?? ""}
          label={t("seasons")}
        />
      </div>
      {triple.length ? (
        <p className="mt-6 rounded-lg bg-gold-soft/60 px-4 py-3 font-semibold">
          {t("tripleCrown")} : {triple.map((x) => t(`division.${x.division}`)).join(", ")}
        </p>
      ) : null}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {DIVISIONS.flatMap((d) =>
          LEAGUE_CADENCES.map((c) => {
            const l = (leagues ?? []).find((x) => x.division === d && x.cadence === c);
            if (!l) return null;
            const rows = (top ?? []).filter((r) => r.league_id === l.id);
            return (
              <section key={l.id} className="rounded-[var(--radius-card)] border border-line p-4">
                <h2 className="font-display text-xl font-semibold">
                  <Link href={`/competitions/ligues/${l.slug}`} className="hover:text-accent">
                    {t(`division.${d}`)} · {t(`cadence.${c}`)}
                  </Link>
                </h2>
                {rows.length ? (
                  <ol className="mt-2 space-y-1">
                    {rows.map((r) => (
                      <li key={r.player_id} className="flex gap-2">
                        <span className="tabular w-5 text-stone">{r.rank}</span>
                        <span className="min-w-0 flex-1 truncate">{r.display_name}</span>
                        <span className="tabular font-semibold">{Number(r.points)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-stone">{t("notStarted")}</p>
                )}
              </section>
            );
          }),
        )}
      </div>
    </div>
  );
}
