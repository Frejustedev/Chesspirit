import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AcademyNav } from "@/components/content/academy-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academy");
  return { title: t("title"), description: t("intro") };
}

export default async function AcademyHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("academy");
  const tc = await getTranslations("coaching");
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons_library")
    .select("slug, title, summary, level, is_premium")
    .order("position")
    .limit(6);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link
          href="/academie/puzzle-du-jour"
          className="rounded-lg bg-ink p-6 text-cream hover:bg-bordeaux md:col-span-1"
        >
          <span className="font-display text-2xl font-semibold">{t("nav.puzzle")}</span>
          <span className="mt-2 block text-cream/80">{t("puzzleCard")}</span>
        </Link>
        <Link
          href="/academie/lexique"
          className="rounded-lg border border-line p-6 hover:border-bordeaux"
        >
          <span className="font-display text-2xl font-semibold">{t("nav.lexicon")}</span>
          <span className="mt-2 block text-stone">{t("lexiconCard")}</span>
        </Link>
        <Link
          href="/academie/ressources"
          className="rounded-lg border border-line p-6 hover:border-bordeaux"
        >
          <span className="font-display text-2xl font-semibold">{t("nav.resources")}</span>
          <span className="mt-2 block text-stone">{t("resourcesCard")}</span>
        </Link>
      </div>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t("nav.lessons")}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(lessons ?? []).map((l) => (
            <li key={l.slug}>
              <Link
                href={`/academie/lecons/${l.slug}`}
                className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
                  {tc(`level.${l.level}`)}
                </span>
                <span className="mt-1 font-display text-xl font-semibold">
                  {tr(l.title, locale)}
                </span>
                <span className="mt-1 text-sm text-stone">{tr(l.summary, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
