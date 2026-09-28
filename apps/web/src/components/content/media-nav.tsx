import { getTranslations } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/i18n-json";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { Json } from "@/lib/supabase/types";

const ITEMS = [
  ["/media/videos", "videos"],
  ["/media/podcasts", "podcasts"],
  ["/media/direct", "live"],
  ["/media/emissions", "shows"],
  ["/media/articles", "articles"],
] as const;

export async function MediaNav({ current }: { current: string }) {
  const t = await getTranslations("media");
  return (
    <nav aria-label={t("title")} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {ITEMS.map(([href, key]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={current === href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${current === href ? "bg-ink text-cream" : "border border-line hover:bg-cream"}`}
            >
              {t(`nav.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type EpisodeCardData = {
  slug: string;
  title: Json;
  format: string;
  language: string;
  level: string | null;
  duration_min: number | null;
  published_at: string | null;
  live_at: string | null;
  is_demo: boolean;
  media_series: { title: Json } | null;
};

export async function EpisodeGrid({
  episodes,
  locale,
}: {
  episodes: EpisodeCardData[];
  locale: string;
}) {
  const t = await getTranslations("media");
  if (!episodes.length) return <p className="mt-6 text-stone">{t("noEpisodes")}</p>;
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {episodes.map((e) => (
        <li key={e.slug}>
          <Link
            href={`/media/episodes/${e.slug}`}
            className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
              {tr(e.media_series?.title ?? null, locale)} · {t(`format.${e.format}`)}
            </span>
            <span className="mt-1 font-display text-xl font-semibold leading-snug">
              {tr(e.title, locale)} {e.is_demo ? <DemoBadge /> : null}
            </span>
            <span className="mt-auto pt-2 text-sm text-stone">
              {[
                e.live_at
                  ? formatDate(e.live_at, locale)
                  : e.published_at
                    ? formatDate(e.published_at, locale)
                    : null,
                e.duration_min ? t("minutes", { n: e.duration_min }) : null,
                t(`lang.${e.language}`),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const EPISODE_CARD =
  "slug, title, format, language, level, duration_min, published_at, live_at, is_demo, media_series(title)";
