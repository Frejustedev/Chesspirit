import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AcademyNav } from "@/components/content/academy-nav";
import { FonSuggestion } from "@/components/content/academy-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academy");
  return { title: t("nav.lexicon"), description: t("lexiconIntro") };
}

const CATEGORIES = [
  "pieces",
  "rules",
  "tactics",
  "strategy",
  "openings",
  "endgames",
  "competition",
  "general",
] as const;

export default async function LexiconPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { categorie } = await searchParams;
  const t = await getTranslations("academy");
  const supabase = await createClient();
  let q = supabase.from("glossary_terms").select("*").order("term_fr");
  if (categorie && (CATEGORIES as readonly string[]).includes(categorie))
    q = q.eq("category", categorie as (typeof CATEGORIES)[number]);
  const { data: terms } = await q;
  const validated = (terms ?? []).filter((x) => x.fon_status === "validated").length;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("nav.lexicon")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("lexiconIntro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie/lexique" />
      </div>
      <p className="mt-6 rounded-lg bg-gold-soft/60 px-4 py-3">
        {t("fonProgress", { done: validated, total: terms?.length ?? 0 })}
      </p>
      <form action="/academie/lexique" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="g-c" className="sr-only">
          {t("category")}
        </label>
        <select
          id="g-c"
          name="categorie"
          defaultValue={categorie ?? ""}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 sm:flex-none"
        >
          <option value="">{t("allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {t("filter")}
        </button>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-stone">
              <th className="py-2 pr-3">{t("fr")}</th>
              <th className="py-2 pr-3">{t("en")}</th>
              <th className="py-2 pr-3">{t("fon")}</th>
              <th className="py-2">{t("definition")}</th>
            </tr>
          </thead>
          <tbody>
            {(terms ?? []).map((x) => (
              <tr key={x.id} className="border-b border-line align-top">
                <td className="py-2 pr-3 font-semibold">{x.term_fr}</td>
                <td className="py-2 pr-3">{x.term_en}</td>
                <td className="py-2 pr-3">
                  {x.fon_status === "validated" && x.term_fon ? (
                    x.term_fon
                  ) : (
                    <>
                      <span className="text-sm text-stone">{t("fonMissing")}</span>
                      <FonSuggestion termId={x.id} />
                    </>
                  )}
                </td>
                <td className="py-2 text-sm">{tr(x.definition, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
