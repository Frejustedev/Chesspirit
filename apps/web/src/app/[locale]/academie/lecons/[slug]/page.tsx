import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { tr } from "@/lib/i18n-json";
import { MiniMarkdown } from "@/lib/mini-markdown";
import type { ContentPosition } from "@/lib/content";
import { PositionList } from "@/components/content/positions";
import { hasPremium } from "@/lib/membership";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons_library")
    .select("*")
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
  const l = await load(slug);
  return l ? { title: tr(l.title, locale), description: tr(l.summary, locale) } : {};
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = await load(slug);
  if (!l) notFound();
  const t = await getTranslations("academy");
  const tc = await getTranslations("coaching");
  const tm = await getTranslations("media");
  const session = await getSession();
  const locked = l.is_premium && !(await hasPremium(session?.profile?.id ?? null));
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <Link href="/academie/lecons" className="text-sm font-semibold text-bordeaux hover:underline">
        ← {t("nav.lessons")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {tr(l.title, locale)}
      </h1>
      <p className="mt-2 text-stone">
        {tc(`level.${l.level}`)} · {tm(`themes.${l.theme}`)}
      </p>
      <p className="mt-4 font-serif text-xl">{tr(l.summary, locale)}</p>
      {locked ? (
        <div className="mt-8 rounded-lg bg-ink p-6 text-cream">
          <p className="font-display text-2xl font-semibold">{t("premiumLocked")}</p>
          <Link
            href="/academie/premium"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("premiumCta")} →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <MiniMarkdown source={tr(l.body, locale)} />
          </div>
          {(l.positions as ContentPosition[]).length ? (
            <div className="mt-8">
              <PositionList positions={l.positions as ContentPosition[]} />
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
