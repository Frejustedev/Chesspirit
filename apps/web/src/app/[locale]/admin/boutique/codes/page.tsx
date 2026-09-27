import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PromoForm, PromoToggle, ShopAdminNav } from "@/components/admin/shop-admin";
import { DemoBadge } from "@/components/ui/demo-badge";

export const metadata: Metadata = {
  title: "Administration — codes promo",
  robots: { index: false },
};

export default async function AdminPromos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/boutique/codes");
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminShop");
  const supabase = await createClient();
  const { data: codes } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("promos")}</h1>
      <ShopAdminNav current="/admin/boutique/codes" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y divide-line border-y border-line">
          {(codes ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="font-mono font-semibold">{c.code}</span>
              {c.is_demo ? <DemoBadge /> : null}
              <span className="text-sm">
                {c.kind === "percent"
                  ? `${c.value} %`
                  : c.kind === "amount"
                    ? formatXof(c.value, locale)
                    : t("freeShipping")}
                {c.min_subtotal_xof
                  ? ` · ${t("min", { v: formatXof(c.min_subtotal_xof, locale) })}`
                  : ""}
                {c.ends_at ? ` · ${t("until", { d: formatDate(c.ends_at, locale) })}` : ""}
              </span>
              <span className="tabular text-sm text-stone">
                {t("uses", { n: c.uses, max: c.max_uses ?? "∞" })}
              </span>
              <span className="ml-auto">
                <PromoToggle id={c.id} active={c.is_active} />
              </span>
            </li>
          ))}
        </ul>
        <PromoForm />
      </div>
    </div>
  );
}
