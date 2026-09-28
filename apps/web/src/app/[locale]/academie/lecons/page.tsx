import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { LEVELS, THEMES } from "@/lib/content";
import { AcademyNav } from "@/components/content/academy-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academy");
  return { title: t("nav.lessons") };
}

export default async function LessonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ niveau?: string; theme?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("academy");
  const tc = await getTranslations("coaching");
  const tm = await getTranslations("media");
  const supabase = await createClient();
  let q = supabase
    .from("lesson_catalog")
    .select("slug, title, summary, level, theme, is_premium")
    .order("position");
  if (sp.niveau && (LEVELS as readonly string[]).includes(sp.niveau)) q = q.eq("level", sp.niveau);
  if (sp.theme && (THEMES as readonly string[]).includes(sp.theme)) q = q.eq("theme", sp.theme);
  const { data: lessons } = await q;
  const sel = "min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 sm:flex-none";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("nav.lessons")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("lessonsIntro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie/lecons" />
      </div>
      <form action="/academie/lecons" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="l-n" className="sr-only">
          {tm("level")}
        </label>
        <select id="l-n" name="niveau" defaultValue={sp.niveau ?? ""} className={sel}>
          <option value="">{tm("allLevels")}</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {tc(`level.${l}`)}
            </option>
          ))}
        </select>
        <label htmlFor="l-t" className="sr-only">
          {tm("theme")}
        </label>
        <select id="l-t" name="theme" defaultValue={sp.theme ?? ""} className={sel}>
          <option value="">{tm("allThemes")}</option>
          {THEMES.map((x) => (
            <option key={x} value={x}>
              {tm(`themes.${x}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {tm("apply")}
        </button>
      </form>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(lessons ?? []).map((l) => (
          <li key={l.slug}>
            <Link
              href={`/academie/lecons/${l.slug}`}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
                {tc(`level.${l.level}`)} · {tm(`themes.${l.theme}`)}
                {l.is_premium ? ` · ${t("premiumBadge")}` : ""}
              </span>
              <span className="mt-1 font-display text-xl font-semibold">{tr(l.title, locale)}</span>
              <span className="mt-1 text-sm text-stone">{tr(l.summary, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!lessons?.length ? <p className="mt-6 text-stone">{t("noLessons")}</p> : null}
    </div>
  );
}
