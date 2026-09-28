import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { ShopAdminNav } from "@/components/admin/shop-admin";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "Administration — produits", robots: { index: false } };

export default async function AdminProducts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/boutique/produits");
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminShop");
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, slug, name, kind, price_xof, is_active, is_preorder, is_demo, product_variants(stock)",
    )
    .order("created_at");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold">{t("products")}</h1>
        <Link
          href="/admin/boutique/produits/nouveau"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bordeaux px-4 font-semibold text-cream hover:bg-bordeaux-bright"
        >
          <IconPlus className="size-5" /> {t("newProduct")}
        </Link>
      </div>
      <ShopAdminNav current="/admin/boutique/produits" />
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(products ?? []).map((p) => {
          const stock = p.product_variants.reduce((s, v) => s + v.stock, 0);
          return (
            <li key={p.id}>
              <Link
                href={`/admin/boutique/produits/${p.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="min-w-0 flex-1 font-semibold group-hover:text-accent">
                  {tr(p.name, locale)} {p.is_demo ? <DemoBadge /> : null}
                </span>
                {!p.is_active ? <span className="text-sm text-stone">{t("inactive")}</span> : null}
                <span className="tabular text-sm">
                  {p.kind === "physical" && !p.is_preorder ? t("stock", { n: stock }) : "—"}
                </span>
                <span className="tabular font-semibold">{formatXof(p.price_xof, locale)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
