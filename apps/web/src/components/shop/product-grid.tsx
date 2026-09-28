import { getLocale, getTranslations } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/i18n-json";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ProductArt } from "@/components/shop/product-art";
import { getCategories, inStock, priceRange, type ProductCard } from "@/lib/shop/data";

export async function ProductGrid({
  products,
  locale,
}: {
  products: ProductCard[];
  locale: string;
}) {
  const t = await getTranslations("shop");
  if (!products.length)
    return (
      <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line p-6 font-serif text-lg text-stone">
        {t("empty")}
      </p>
    );
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => {
        const name = tr(p.name, locale);
        const range = priceRange(p);
        const available = inStock(p);
        return (
          <li key={p.id}>
            <Link href={`/boutique/produit/${p.slug}`} className="group block">
              <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line">
                <ProductArt
                  art={p.art}
                  imageUrl={p.image_url}
                  alt={name}
                  className="aspect-[10/9] w-full transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {p.is_preorder ? (
                    <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-cream">
                      {t("preorder")}
                    </span>
                  ) : null}
                  {!available ? (
                    <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-stone">
                      {t("soldOut")}
                    </span>
                  ) : null}
                  {p.compare_at_xof && p.compare_at_xof > p.price_xof ? (
                    <span className="rounded-full bg-bordeaux px-2 py-0.5 text-xs font-semibold text-cream">
                      -{Math.round((1 - p.price_xof / p.compare_at_xof) * 100)} %
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 font-semibold leading-snug group-hover:text-bordeaux">{name}</p>
              <p className="tabular mt-0.5 text-[0.95rem]">
                {range.min !== range.max ? `${t("from")} ` : ""}
                {formatXof(range.min, locale)}
                {p.compare_at_xof && p.compare_at_xof > p.price_xof ? (
                  <s className="ml-2 text-sm text-stone">{formatXof(p.compare_at_xof, locale)}</s>
                ) : null}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone">
                {p.reviews_count ? (
                  <span>
                    ★ {p.rating_avg} ({p.reviews_count})
                  </span>
                ) : null}
                {p.is_demo ? <DemoBadge /> : null}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export async function ShopNav({ current }: { current?: string }) {
  const t = await getTranslations("shop");
  const [cats, locale] = await Promise.all([getCategories(), getLocale()]);
  const item = (href: string, label: string, active: boolean) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[0.95rem] font-semibold ${active ? "bg-ink text-cream" : "border border-line hover:bg-cream"}`}
      >
        {label}
      </Link>
    </li>
  );
  return (
    <nav aria-label={t("categories")} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {item("/boutique", t("all"), !current)}
        {cats.map((c) => item(`/boutique/${c.slug}`, tr(c.name, locale), current === c.slug))}
        {item("/boutique/location", t("rental"), current === "location")}
      </ul>
    </nav>
  );
}
