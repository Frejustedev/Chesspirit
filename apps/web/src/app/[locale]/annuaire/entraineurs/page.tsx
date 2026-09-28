import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { DirectoryNav, cleanQuery } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("coachesTitle") };
}

export default async function CoachesDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; langue?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("directory");
  const tc = await getTranslations("coaching");
  const supabase = await createClient();
  let q = supabase
    .from("public_coaches")
    .select("*")
    .order("is_chesspirit", { ascending: false })
    .limit(200);
  if (sp.langue && ["fr", "en", "fon"].includes(sp.langue))
    q = q.contains("languages", [sp.langue]);
  const { data } = await q;
  const needle = cleanQuery(sp.q);
  const rows = (data ?? []).filter(
    (c) =>
      !needle ||
      `${c.display_name} ${c.city ?? ""} ${c.zone ?? ""}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(needle),
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("coachesTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("coachesIntro")}</p>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/entraineurs" />
      </div>
      <form action="/annuaire/entraineurs" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="c-q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="c-q"
          name="q"
          defaultValue={sp.q}
          placeholder={t("search")}
          className="min-h-11 min-w-0 basis-full rounded-md border border-line bg-field px-3 sm:flex-1 sm:basis-auto"
        />
        <label htmlFor="c-l" className="sr-only">
          {t("language")}
        </label>
        <select
          id="c-l"
          name="langue"
          defaultValue={sp.langue ?? ""}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 sm:flex-none"
        >
          <option value="">{t("allLanguages")}</option>
          {(["fr", "en", "fon"] as const).map((l) => (
            <option key={l} value={l}>
              {tc(`lang.${l}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
        >
          {t("apply")}
        </button>
      </form>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/coaching/coachs/${c.slug}`}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-accent"
            >
              <span className="font-semibold">
                {c.titles?.length ? (
                  <span className="mr-1 text-accent">{c.titles.join(" ")}</span>
                ) : null}
                {c.display_name} {c.is_demo ? <DemoBadge /> : null}
              </span>
              <span className="text-sm text-stone">{tr(c.headline, locale)}</span>
              <span className="mt-2 text-sm">
                {[c.city, (c.languages ?? []).map((l) => tc(`lang.${l}`)).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {c.price_from ? (
                <span className="tabular mt-1 text-sm font-semibold">
                  {t("from", { price: formatXof(c.price_from, locale) })}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-6 text-stone">{t("empty")}</p> : null}
      <p className="mt-8 text-sm">
        <Link href="/coaching/devenir-coach" className="font-semibold text-accent hover:underline">
          {t("becomeCoach")} →
        </Link>
      </p>
    </div>
  );
}
