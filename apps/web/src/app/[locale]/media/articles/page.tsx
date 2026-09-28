import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { MediaNav } from "@/components/content/media-nav";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("media");
  return { title: t("articles") };
}

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("media");
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, excerpt, published_at, is_demo, tags")
    .order("published_at", { ascending: false })
    .limit(100);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("articles")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("articlesIntro")}</p>
      <div className="mt-6">
        <MediaNav current="/media/articles" />
      </div>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {(articles ?? []).map((a) => (
          <li key={a.slug} className="py-4">
            <Link
              href={`/media/articles/${a.slug}`}
              className="font-display text-2xl font-semibold hover:text-accent"
            >
              {tr(a.title, locale)}
            </Link>{" "}
            {a.is_demo ? <DemoBadge /> : null}
            <p className="text-sm text-stone">
              {a.published_at ? formatDate(a.published_at, locale) : ""}
            </p>
            <p className="mt-1">{tr(a.excerpt, locale)}</p>
          </li>
        ))}
      </ul>
      {!articles?.length ? <p className="mt-6 text-stone">{t("noArticles")}</p> : null}
    </div>
  );
}
