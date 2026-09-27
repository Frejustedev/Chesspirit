import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getShopSettings } from "@/lib/shop/data";
import { CheckoutForm } from "@/components/shop/checkout-form";

export const metadata: Metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/boutique/commande");
  const t = await getTranslations("shop");
  const supabase = await createClient();
  const [settings, { data: points }] = await Promise.all([
    getShopSettings(),
    supabase.rpc("loyalty_balance"),
  ]);
  const p = session.profile!;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("checkoutTitle")}</h1>
      <div className="mt-6">
        <CheckoutForm
          settings={settings}
          points={points ?? 0}
          defaults={{
            name: `${p.first_name} ${p.last_name}`.trim(),
            phone: p.phone ?? session.phone ?? "",
            email: p.email ?? session.email ?? "",
            city: p.city ?? "",
          }}
        />
      </div>
    </div>
  );
}
