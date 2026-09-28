import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { MiniMarkdown } from "@/lib/mini-markdown";
import { DemoBadge } from "@/components/ui/demo-badge";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("*, tournaments(slug, name)")
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
  const a = await load(slug);
  return a ? { title: tr(a.title, locale), description: tr(a.excerpt, locale) } : {};
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const a = await load(slug);
  if (!a) notFound();
  const t = await getTranslations("media");
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <Link href="/media/articles" className="text-sm font-semibold text-accent hover:underline">
        ← {t("articles")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {tr(a.title, locale)} {a.is_demo ? <DemoBadge /> : null}
      </h1>
      <p className="mt-2 text-stone">{a.published_at ? formatDate(a.published_at, locale) : ""}</p>
      {tr(a.excerpt, locale) ? (
        <p className="mt-4 font-serif text-xl">{tr(a.excerpt, locale)}</p>
      ) : null}
      <div className="mt-6">
        <MiniMarkdown source={tr(a.body, locale)} />
      </div>
      {a.tournaments ? (
        <p className="mt-8">
          <Link
            href={`/competitions/${a.tournaments.slug}/resultats`}
            className="font-semibold text-accent hover:underline"
          >
            {t("seeResults", { name: a.tournaments.name })} →
          </Link>
        </p>
      ) : null}
    </article>
  );
}
