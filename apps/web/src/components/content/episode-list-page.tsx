import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LEVELS } from "@/lib/content";
import { EPISODE_CARD, EpisodeGrid, MediaNav, type EpisodeCardData } from "./media-nav";

/** Liste d'épisodes filtrable (langue, niveau, thème) pour un format donné. */
export async function EpisodeListPage({
  locale,
  format,
  path,
  titleKey,
  sp,
}: {
  locale: string;
  format: "video" | "audio" | "live";
  path: string;
  titleKey: string;
  sp: { langue?: string; niveau?: string; theme?: string };
}) {
  const t = await getTranslations("media");
  const tc = await getTranslations("coaching");
  const supabase = await createClient();
  let q = supabase
    .from("media_episodes")
    .select(EPISODE_CARD)
    .eq("format", format)
    .order(format === "live" ? "live_at" : "published_at", { ascending: false })
    .limit(60);
  if (sp.langue && ["fr", "en", "fon"].includes(sp.langue)) q = q.eq("language", sp.langue);
  if (sp.niveau && (LEVELS as readonly string[]).includes(sp.niveau)) q = q.eq("level", sp.niveau);
  if (sp.theme && /^[a-z]{3,20}$/.test(sp.theme)) q = q.eq("theme", sp.theme);
  const { data } = await q;
  const sel = "min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 sm:flex-none";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t(titleKey)}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t(`${titleKey}Intro`)}</p>
      <div className="mt-6">
        <MediaNav current={path} />
      </div>
      <form action={path} className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="m-l" className="sr-only">
          {t("language")}
        </label>
        <select id="m-l" name="langue" defaultValue={sp.langue ?? ""} className={sel}>
          <option value="">{t("allLanguages")}</option>
          {(["fr", "en", "fon"] as const).map((l) => (
            <option key={l} value={l}>
              {t(`lang.${l}`)}
            </option>
          ))}
        </select>
        <label htmlFor="m-n" className="sr-only">
          {t("level")}
        </label>
        <select id="m-n" name="niveau" defaultValue={sp.niveau ?? ""} className={sel}>
          <option value="">{t("allLevels")}</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {tc(`level.${l}`)}
            </option>
          ))}
        </select>
        <label htmlFor="m-t" className="sr-only">
          {t("theme")}
        </label>
        <select id="m-t" name="theme" defaultValue={sp.theme ?? ""} className={sel}>
          <option value="">{t("allThemes")}</option>
          {(["rules", "tactics", "strategy", "openings", "endgames", "competition"] as const).map(
            (x) => (
              <option key={x} value={x}>
                {t(`themes.${x}`)}
              </option>
            ),
          )}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {t("apply")}
        </button>
      </form>
      <EpisodeGrid episodes={(data ?? []) as unknown as EpisodeCardData[]} locale={locale} />
    </div>
  );
}
