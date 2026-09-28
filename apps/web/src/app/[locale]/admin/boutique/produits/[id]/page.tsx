import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { ProductEditor, type ProductDraft } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Administration — produit", robots: { index: false } };

const i18n = (v: unknown) => {
  const o = (v ?? {}) as Record<string, string>;
  return { fr: o.fr ?? "", en: o.en ?? "" };
};

export default async function AdminProduct({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const isNew = id === "nouveau";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { admin } = await requireStaff(locale, `/admin/boutique/produits/${id}`);
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminShop");
  const supabase = await createClient();
  const [{ data: cats }, { data: p }] = await Promise.all([
    supabase.from("product_categories").select("id, name").order("position"),
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from("products").select("*, product_variants(*)").eq("id", id).maybeSingle(),
  ]);
  if (!isNew && !p) notFound();
  const draft: ProductDraft = p
    ? {
        id: p.id,
        slug: p.slug,
        categoryId: p.category_id,
        kind: p.kind as "physical" | "gift_card",
        name: i18n(p.name),
        description: i18n(p.description),
        priceXof: p.price_xof,
        compareAtXof: p.compare_at_xof,
        art: p.art,
        imageUrl: p.image_url ?? "",
        isActive: p.is_active,
        isFeatured: p.is_featured,
        isPreorder: p.is_preorder,
        preorderDate: p.preorder_date,
        variants: [...p.product_variants]
          .sort((a, b) => a.position - b.position)
          .map((v) => ({
            id: v.id,
            name: i18n(v.name),
            sku: v.sku,
            priceXof: v.price_xof,
            stock: v.stock,
            isActive: v.is_active,
          })),
      }
    : {
        slug: "",
        categoryId: cats?.[0]?.id ?? null,
        kind: "physical",
        name: { fr: "", en: "" },
        description: { fr: "", en: "" },
        priceXof: 0,
        compareAtXof: null,
        art: "board",
        imageUrl: "",
        isActive: false,
        isFeatured: false,
        isPreorder: false,
        preorderDate: null,
        variants: [
          {
            name: { fr: "Standard", en: "Standard" },
            sku: null,
            priceXof: null,
            stock: 0,
            isActive: true,
          },
        ],
      };
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <Link
        href="/admin/boutique/produits"
        className="text-sm font-semibold text-bordeaux hover:underline"
      >
        ← {t("products")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {isNew ? t("newProduct") : tr(p!.name, locale)}
      </h1>
      <div className="mt-6">
        <ProductEditor
          draft={draft}
          categories={(cats ?? []).map((c) => ({ id: c.id, name: tr(c.name, locale) }))}
        />
      </div>
    </div>
  );
}
