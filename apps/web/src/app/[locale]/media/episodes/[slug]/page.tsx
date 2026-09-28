import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatDateTime } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { embedUrl, type ContentPosition } from "@/lib/content";
import { PositionList, VideoEmbed } from "@/components/content/positions";
import { DemoBadge } from "@/components/ui/demo-badge";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_episodes")
    .select("*, media_series(slug, title)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const e = await load(slug);
  return e
    ? { title: tr(e.title, locale), description: tr(e.description, locale).slice(0, 160) }
    : {};
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const e = await load(slug);
  if (!e) notFound();
  const t = await getTranslations("media");
  const tc = await getTranslations("coaching");
  const title = tr(e.title, locale);
  const video = embedUrl(e.video_url);
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      {e.media_series ? (
        <Link
          href={`/media/emissions/${e.media_series.slug}`}
          className="text-sm font-semibold text-bordeaux hover:underline"
        >
          ← {tr(e.media_series.title, locale)}
        </Link>
      ) : null}
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {title} {e.is_demo ? <DemoBadge /> : null}
      </h1>
      <p className="mt-2 text-stone">
        {[
          t("seasonEpisode", { s: e.season, n: e.number }),
          t(`format.${e.format}`),
          t(`lang.${e.language}`),
          e.level ? tc(`level.${e.level}`) : null,
          e.published_at ? formatDate(e.published_at, locale) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-6">
        {video ? (
          <VideoEmbed src={video} title={title} />
        ) : e.audio_url ? (
          <audio controls preload="none" src={e.audio_url} className="w-full">
            <a href={e.audio_url}>{t("listen")}</a>
          </audio>
        ) : e.format === "live" && e.live_at ? (
          <p className="rounded-lg bg-ink p-6 font-display text-2xl text-cream">
            {t("liveOn", { date: formatDateTime(e.live_at, locale) })}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-6 text-stone">
            {t("mediaSoon")}
          </p>
        )}
      </div>
      {tr(e.description, locale) ? (
        <p className="mt-6 whitespace-pre-line font-serif text-lg">{tr(e.description, locale)}</p>
      ) : null}
      {(e.positions as ContentPosition[]).length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("positions")}</h2>
          <div className="mt-4">
            <PositionList positions={e.positions as ContentPosition[]} />
          </div>
        </section>
      ) : null}
      {e.transcript ? (
        <details className="mt-10 rounded-lg border border-line p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            {t("transcript")}
          </summary>
          <p className="mt-2 whitespace-pre-line">{e.transcript}</p>
        </details>
      ) : null}
    </article>
  );
}
