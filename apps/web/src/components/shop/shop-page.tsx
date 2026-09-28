import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProducts, getShopSettings } from "@/lib/shop/data";
import { ProductGrid, ShopNav } from "@/components/shop/product-grid";
import { formatXof } from "@chesspirit/shared";
import { onlinePaymentsEnabled } from "@/lib/payments";

export async function ShopPage({
  locale,
  category,
  title,
  intro,
  sort,
  q,
}: {
  locale: string;
  category?: string;
  title: string;
  intro: string;
  sort?: string;
  q?: string;
}) {
  const t = await getTranslations("shop");
  const [products, settings, online] = await Promise.all([
    getProducts({ category, sort, q }),
    getShopSettings(),
    onlinePaymentsEnabled(),
  ]);
  const base = category ? `/boutique/${category}` : "/boutique";
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{intro}</p>
        </div>
        {/* Conditions affichées avec le catalogue : sans produit, rien à livrer ni à payer. */}
        {products.length ? (
          <ul className="grid gap-1 text-sm text-stone lg:justify-self-end">
            <li>
              {t("perkDelivery", { fee: formatXof(settings.cotonou, locale) })}
              {settings.freeFrom
                ? ` · ${t("perkFree", { from: formatXof(settings.freeFrom, locale) })}`
                : ""}
            </li>
            <li>{t("perkPickup")}</li>
            <li>{online ? t("perkPay") : t("perkPaySoon")}</li>
          </ul>
        ) : null}
      </div>
      <div className="mt-8">
        <ShopNav current={category} />
      </div>
      <form action={base} className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="shop-q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="shop-q"
          name="q"
          defaultValue={q}
          placeholder={t("search")}
          className="min-h-11 min-w-0 basis-full rounded-md sm:flex-1 sm:basis-auto border border-line bg-white px-3"
        />
        <label htmlFor="shop-sort" className="sr-only">
          {t("sort")}
        </label>
        <select
          id="shop-sort"
          name="tri"
          defaultValue={sort ?? ""}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 sm:flex-none"
        >
          <option value="">{t("sortFeatured")}</option>
          <option value="price_asc">{t("sortPriceAsc")}</option>
          <option value="price_desc">{t("sortPriceDesc")}</option>
          <option value="new">{t("sortNew")}</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream"
        >
          {t("apply")}
        </button>
      </form>
      <ProductGrid products={products} locale={locale} />
      <section className="mt-14 grid gap-6 rounded-lg bg-ink p-6 text-cream sm:grid-cols-3 sm:p-8">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("groupTitle")}</h2>
          <p className="mt-2 text-cream/80">{t("groupText")}</p>
          <Link
            href="/boutique/location?type=group_order"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("groupCta")} →
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("rentalTitle")}</h2>
          <p className="mt-2 text-cream/80">{t("rentalText")}</p>
          <Link
            href="/boutique/location"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("rentalCta")} →
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("trackTitle")}</h2>
          <p className="mt-2 text-cream/80">{t("trackText")}</p>
          <Link
            href="/boutique/suivi"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
          >
            {t("trackCta")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
