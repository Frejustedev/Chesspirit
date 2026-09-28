import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSeasons, pickSeason } from "@/lib/data/leagues";
import { SeasonPicker } from "@/components/competitions/season-picker";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Tbc } from "@/components/ui/tbc";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("title"), description: t("intro") };
}

export default async function TourPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saison?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { saison } = await searchParams;
  const t = await getTranslations("tour");
  const [season, seasons] = await Promise.all([pickSeason(saison), getSeasons()]);
  const supabase = await createClient();
  const [{ data: stages }, { data: scale }] = await Promise.all([
    season
      ? supabase
          .from("tour_stages")
          .select("*, tournaments(slug, name, starts_at)")
          .eq("season_id", season.id)
          .order("number")
      : Promise.resolve({ data: [] }),
    supabase.from("scoring_scales").select("*").eq("is_default", true).maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-3xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <SeasonPicker
          base="/competitions/tour"
          seasons={seasons}
          current={season?.slug ?? ""}
          label={t("seasons")}
        />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-display text-2xl font-semibold">
            {t("stages")} {season?.is_demo ? <DemoBadge /> : null}
          </h2>
          <ol className="mt-4 space-y-3">
            {(stages ?? []).map((s) => (
              <li
                key={s.id}
                className="flex gap-4 rounded-[var(--radius-card)] border border-line p-4"
              >
                <span className="tabular grid size-11 shrink-0 place-items-center rounded-full bg-cream font-display text-xl font-semibold">
                  {s.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {s.tournaments ? (
                      <Link
                        href={`/competitions/${s.tournaments.slug}`}
                        className="hover:text-bordeaux"
                      >
                        {s.name}
                      </Link>
                    ) : (
                      s.name
                    )}
                  </p>
                  <p className="text-sm text-stone">
                    {s.city} ·{" "}
                    {s.planned_on || s.tournaments?.starts_at ? (
                      formatDate(s.planned_on ?? s.tournaments!.starts_at, locale)
                    ) : (
                      <Tbc />
                    )}
                  </p>
                </div>
                <span className="self-start rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-cream">
                  {t(`kind.${s.kind}`)} × {Number(s.coefficient).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ol>
          {!stages?.length ? <p className="mt-3 text-stone">{t("noStages")}</p> : null}
          <Link
            href={`/classements/tour${season ? `?saison=${season.slug}` : ""}`}
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-bordeaux px-5 font-semibold text-cream hover:bg-ink"
          >
            {t("seeRanking")}
          </Link>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("rulesTitle")}</h2>
          <ul className="mt-3 space-y-2">
            <li>{t("ruleMajors")}</li>
            <li>{t("ruleOnline")}</li>
            <li>{t("ruleBest", { n: season?.tour_best_results ?? 6 })}</li>
            <li>{t("ruleCategories")}</li>
            <li>
              {t("ruleMasters", {
                q: season?.masters_qualified ?? 8,
                i: season?.masters_invited ?? 2,
              })}
            </li>
          </ul>
          {scale ? (
            <>
              <h3 className="mt-6 font-semibold">
                {t("scale", { p: Number(scale.participation) })}
              </h3>
              <ol className="tabular mt-2 grid grid-cols-5 gap-1 text-sm">
                {scale.places.slice(0, 15).map((pts, i) => (
                  <li key={i} className="rounded bg-cream px-2 py-1 text-center">
                    <span className="block text-xs text-stone">{i + 1}</span>
                    {pts}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-stone">{t("scaleMore")}</p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
