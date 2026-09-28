import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { EPISODE_CARD, EpisodeGrid, type EpisodeCardData } from "@/components/content/media-nav";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("media_series").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = await load(slug);
  return s ? { title: tr(s.title, locale), description: tr(s.description, locale) } : {};
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const s = await load(slug);
  if (!s) notFound();
  const t = await getTranslations("media");
  const supabase = await createClient();
  const { data: episodes } = await supabase
    .from("media_episodes")
    .select(`${EPISODE_CARD}, season`)
    .eq("series_id", s.id)
    .order("season", { ascending: false })
    .order("number", { ascending: false });
  const seasons = [...new Set((episodes ?? []).map((e) => e.season))];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <Link href="/media/emissions" className="text-sm font-semibold text-bordeaux hover:underline">
        ← {t("shows")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {tr(s.title, locale)}
      </h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{tr(s.description, locale)}</p>
      {seasons.length ? (
        seasons.map((season) => (
          <section key={season} className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("season", { n: season })}</h2>
            <EpisodeGrid
              episodes={
                (episodes ?? []).filter((e) => e.season === season) as unknown as EpisodeCardData[]
              }
              locale={locale}
            />
          </section>
        ))
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-line p-6 font-serif text-lg text-stone">
          {t("comingSoon")}
        </p>
      )}
    </div>
  );
}
