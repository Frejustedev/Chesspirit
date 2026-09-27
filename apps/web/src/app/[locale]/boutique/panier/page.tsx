import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/shop/cart-view";

export const metadata: Metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("cart")}</h1>
      <div className="mt-6">
        <CartView />
      </div>
    </div>
  );
}
