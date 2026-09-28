import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { MediaNav } from "@/components/content/media-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("media");
  return { title: t("shows") };
}

export default async function ShowsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("media");
  const supabase = await createClient();
  const { data: series } = await supabase
    .from("media_series")
    .select("slug, title, description, kind, language, media_episodes(count)")
    .order("position");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("shows")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("showsIntro")}</p>
      <div className="mt-6">
        <MediaNav current="/media/emissions" />
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {(series ?? []).map((s) => (
          <li key={s.slug}>
            <Link
              href={`/media/emissions/${s.slug}`}
              className="flex h-full flex-col rounded-lg border border-line p-5 hover:border-bordeaux"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
                {t(`kind.${s.kind}`)} · {t(`lang.${s.language}`)}
              </span>
              <span className="mt-1 font-display text-2xl font-semibold">
                {tr(s.title, locale)}
              </span>
              <span className="mt-2 text-stone">{tr(s.description, locale)}</span>
              <span className="mt-3 text-sm font-semibold">
                {t("episodesCount", {
                  n: (s.media_episodes as unknown as { count: number }[])[0]?.count ?? 0,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
