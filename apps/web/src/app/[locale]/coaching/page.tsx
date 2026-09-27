import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listOffers, type OfferFilters } from "@/lib/coaching/data";
import { OfferCard, OfferFiltersBar } from "@/components/coaching/offer-card";
import { PieceSvg } from "@/components/icons/pieces";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coaching");
  return { title: t("title"), description: t("intro") };
}

export default async function CoachingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<OfferFilters>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const f = await searchParams;
  const t = await getTranslations("coaching");
  const offers = await listOffers(f);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            href="/coaching/test-de-niveau"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/25 px-4 font-semibold hover:bg-cream"
          >
            <PieceSvg kind="p" color="w" className="size-6" /> {t("placementCta")}
          </Link>
          <Link
            href="/coaching/coachs"
            className="inline-flex min-h-11 items-center rounded-full border border-ink/25 px-4 font-semibold hover:bg-cream"
          >
            {t("coachesCta")}
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <OfferFiltersBar base="/coaching" f={f} />
      </div>
      {offers.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <OfferCard key={o.id} o={o} locale={locale} />
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line p-6 font-serif text-lg text-stone">
          {t("noOffers")}
        </p>
      )}
      <section className="mt-14 grid gap-6 rounded-lg bg-ink p-6 text-cream sm:grid-cols-2 sm:p-8">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("schoolsTitle")}</h2>
          <p className="mt-2 text-cream/80">{t("schoolsText")}</p>
          <Link
            href="/coaching/ecoles-entreprises"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("schoolsCta")} →
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("becomeTitle")}</h2>
          <p className="mt-2 text-cream/80">{t("becomeText")}</p>
          <Link
            href="/coaching/devenir-coach"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("becomeCta")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
