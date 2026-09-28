import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import {
  EPISODE_CARD,
  EpisodeGrid,
  MediaNav,
  type EpisodeCardData,
} from "@/components/content/media-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("media");
  return { title: t("title"), description: t("intro") };
}

export default async function MediaHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("media");
  const supabase = await createClient();
  const [{ data: episodes }, { data: series }, { data: articles }] = await Promise.all([
    supabase
      .from("media_episodes")
      .select(EPISODE_CARD)
      .order("published_at", { ascending: false })
      .limit(6),
    supabase.from("media_series").select("slug, title, description, kind").order("position"),
    supabase
      .from("articles")
      .select("slug, title, excerpt, published_at, is_demo")
      .order("published_at", { ascending: false })
      .limit(4),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <MediaNav current="/media" />
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("latest")}</h2>
        <EpisodeGrid episodes={(episodes ?? []) as unknown as EpisodeCardData[]} locale={locale} />
      </section>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t("nav.shows")}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(series ?? []).map((s) => (
            <li key={s.slug}>
              <Link
                href={`/media/emissions/${s.slug}`}
                className="flex h-full flex-col rounded-lg bg-ink p-5 text-cream hover:bg-bordeaux"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                  {t(`kind.${s.kind}`)}
                </span>
                <span className="mt-1 font-display text-2xl font-semibold">
                  {tr(s.title, locale)}
                </span>
                <span className="mt-2 text-cream/80">{tr(s.description, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {articles?.length ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">{t("nav.articles")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {articles.map((a) => (
              <li key={a.slug} className="py-3">
                <Link
                  href={`/media/articles/${a.slug}`}
                  className="font-semibold hover:text-bordeaux"
                >
                  {tr(a.title, locale)}
                </Link>
                <span className="block text-sm text-stone">
                  {a.published_at ? formatDate(a.published_at, locale) : ""} ·{" "}
                  {tr(a.excerpt, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
