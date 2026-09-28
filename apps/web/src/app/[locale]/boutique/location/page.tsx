import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShopNav } from "@/components/shop/product-grid";
import { QuoteForm } from "@/app/[locale]/coaching/ecoles-entreprises/quote-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("rentalPageTitle"), description: t("rentalIntro") };
}

export default async function RentalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { type } = await searchParams;
  const t = await getTranslations("shop");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <ShopNav current="location" />
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            {t("rentalPageTitle")}
          </h1>
          <p className="mt-3 font-serif text-xl text-stone">{t("rentalIntro")}</p>
          <ul className="mt-6 space-y-3">
            {(["rentalItem1", "rentalItem2", "rentalItem3", "rentalItem4"] as const).map((k) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-gold" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone">{t("rentalNote")}</p>
        </div>
        <QuoteForm defaultKind={type === "group_order" ? "group_order" : "rental"} />
      </div>
    </div>
  );
}
