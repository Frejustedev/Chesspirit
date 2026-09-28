import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShopPage } from "@/components/shop/shop-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("title"), description: t("intro") };
}

export default async function Boutique({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tri?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tri, q } = await searchParams;
  const t = await getTranslations("shop");
  return (
    <ShopPage
      locale={locale}
      title={t("title")}
      intro={t("intro")}
      sort={tri}
      q={q?.slice(0, 80)}
    />
  );
}
