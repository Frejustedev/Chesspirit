import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShopPage } from "@/components/shop/shop-page";
import { getCategories } from "@/lib/shop/data";
import { tr } from "@/lib/i18n-json";

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const c = await findCategory(category);
  return c ? { title: tr(c.name, locale) } : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ tri?: string; q?: string }>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const c = await findCategory(category);
  if (!c) notFound();
  const { tri, q } = await searchParams;
  const t = await getTranslations("shop");
  return (
    <ShopPage
      locale={locale}
      category={c.slug}
      title={tr(c.name, locale)}
      intro={tr(c.description, locale) || t("intro")}
      sort={tri}
      q={q?.slice(0, 80)}
    />
  );
}
