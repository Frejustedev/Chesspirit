import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { tourCategories, TOUR_CATEGORIES, type TourCategory } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSeasons, pickSeason } from "@/lib/data/leagues";
import { SeasonPicker } from "@/components/competitions/season-picker";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("rankingTitle") };
}

export default async function TourRanking({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saison?: string; categorie?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const cat = (TOUR_CATEGORIES as readonly string[]).includes(sp.categorie ?? "")
    ? (sp.categorie as TourCategory)
    : "general";
  const t = await getTranslations("tour");
  const [season, seasons] = await Promise.all([pickSeason(sp.saison), getSeasons()]);
  const supabase = await createClient();
  const { data: rows } = season
    ? await supabase.from("tour_standings").select("*").eq("season_id", season.id).order("rank")
    : { data: [] };
  const filtered = (rows ?? []).filter((r) =>
    tourCategories({
      age: r.age,
      ageGroup: r.age_group === "u14" || r.age_group === "u18" ? r.age_group : null,
      sex: r.is_woman ? "F" : r.sex === "M" ? "M" : null,
      rating: r.rapid_rating,
    }).includes(cat),
  );
  const qualified = season?.masters_qualified ?? 8;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("rankingTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">
        {t("rankingIntro", { n: season?.tour_best_results ?? 6 })}
      </p>
      <div className="mt-6">
        <SeasonPicker
          base="/classements/tour"
          seasons={seasons}
          current={season?.slug ?? ""}
          label={t("seasons")}
        />
      </div>
      <nav aria-label={t("categories")} className="-mx-4 mt-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TOUR_CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={`/classements/tour?${new URLSearchParams({ ...(season ? { saison: season.slug } : {}), categorie: c })}`}
                aria-current={c === cat ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${c === cat ? "bg-gold text-onaccent" : "border border-line hover:bg-surface"}`}
              >
                {t(`category.${c}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {season?.is_demo ? (
        <p className="mt-4">
          <DemoBadge />
        </p>
      ) : null}
      {filtered.length ? (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {filtered.map((r, i) => (
            <li key={r.profile_id} className="flex items-center gap-3 py-3">
              <span className="tabular w-8 text-right font-semibold">
                {cat === "general" ? r.rank : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/joueurs/${r.profile_id}`} className="font-semibold hover:text-accent">
                  {r.display_name}
                </Link>
                {cat === "general" && Number(r.rank) <= qualified ? (
                  <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-onaccent">
                    {t("mastersZone")}
                  </span>
                ) : null}
                {r.club ? <span className="block text-sm text-stone">{r.club}</span> : null}
              </span>
              <span className="text-sm text-stone">
                {t("stagesCount", { n: Number(r.stages) })}
              </span>
              <span className="tabular w-16 text-right font-display text-xl font-semibold">
                {Number(r.total)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-stone">{t("noPoints")}</p>
      )}
    </div>
  );
}
