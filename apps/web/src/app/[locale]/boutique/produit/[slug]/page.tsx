import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getProduct } from "@/lib/shop/data";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { ProductArt } from "@/components/shop/product-art";
import { DemoBadge } from "@/components/ui/demo-badge";
import { AddToCart } from "@/components/shop/add-to-cart";
import { WishlistButton, ReviewForm } from "@/components/shop/product-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return { title: tr(p.name, locale), description: tr(p.description, locale).slice(0, 160) };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = await getProduct(slug);
  if (!p) notFound();
  const t = await getTranslations("shop");
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: reviews }, wished, bought] = await Promise.all([
    supabase
      .from("product_reviews")
      .select("id, rating, body, created_at, profile_id")
      .eq("product_id", p.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30),
    session?.profile
      ? supabase
          .from("wishlists")
          .select("product_id")
          .eq("product_id", p.id)
          .eq("profile_id", session.profile.id)
          .maybeSingle()
          .then((r) => !!r.data)
      : Promise.resolve(false),
    session?.profile
      ? supabase
          .from("order_items")
          .select("id, orders!inner(status)")
          .eq("product_id", p.id)
          .in("orders.status", ["paid", "preparing", "ready_for_pickup", "shipped", "delivered"])
          .limit(1)
          .then((r) => !!r.data?.length)
      : Promise.resolve(false),
  ]);
  const authorIds = [...new Set((reviews ?? []).map((r) => r.profile_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, display_name").in("id", authorIds)
    : { data: [] };
  const authorName = (id: string) => authors?.find((a) => a.id === id)?.display_name ?? t("buyer");
  const name = tr(p.name, locale);
  const variants = [...p.product_variants]
    .filter((v) => v.is_active)
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      name: tr(v.name, locale),
      price: v.price_xof ?? p.price_xof,
      stock: v.stock,
    }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: tr(p.description, locale),
    offers: variants.map((v) => ({
      "@type": "Offer",
      price: v.price,
      priceCurrency: "XOF",
      availability:
        p.kind !== "physical" || p.is_preorder || v.stock > 0
          ? p.is_preorder
            ? "https://schema.org/PreOrder"
            : "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    })),
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label={t("breadcrumb")} className="text-sm text-stone">
        <Link href="/boutique" className="hover:text-bordeaux">
          {t("title")}
        </Link>
        {p.product_categories ? (
          <>
            {" / "}
            <Link href={`/boutique/${p.product_categories.slug}`} className="hover:text-bordeaux">
              {tr(p.product_categories.name, locale)}
            </Link>
          </>
        ) : null}
      </nav>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-line">
          <ProductArt
            art={p.art}
            imageUrl={p.image_url}
            alt={name}
            className="aspect-[10/9] w-full"
          />
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold">{name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone">
            {p.reviews_count ? (
              <span>
                ★ {p.rating_avg} · {t("reviewsCount", { n: p.reviews_count })}
              </span>
            ) : null}
            {p.is_demo ? <DemoBadge /> : null}
          </p>
          {p.is_preorder ? (
            <p className="mt-3 rounded bg-gold-soft/60 px-3 py-2 text-sm font-semibold">
              {t("preorderNote", {
                date: p.preorder_date ? formatDate(p.preorder_date, locale) : t("tbc"),
              })}
            </p>
          ) : null}
          <div className="mt-5">
            <AddToCart
              variants={variants}
              compareAt={p.compare_at_xof}
              isGiftCard={p.kind === "gift_card"}
              tracksStock={p.kind === "physical" && !p.is_preorder}
            />
          </div>
          <div className="mt-4">
            <WishlistButton productId={p.id} initial={wished} signedIn={!!session?.profile} />
          </div>
          <div className="mt-8 whitespace-pre-line font-serif text-lg leading-relaxed">
            {tr(p.description, locale)}
          </div>
        </div>
      </div>
      <section className="mt-14 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold">{t("reviews")}</h2>
        {reviews?.length ? (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-line pb-4">
                <p className="font-semibold">
                  <span aria-label={t("stars", { n: r.rating })}>
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </span>{" "}
                  · {authorName(r.profile_id)} · {formatDate(r.created_at, locale)}
                </p>
                {r.body ? <p className="mt-1 text-ink/85">{r.body}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-stone">{t("noReviews")}</p>
        )}
        {bought ? (
          <div className="mt-6">
            <ReviewForm productId={p.id} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone">{t("reviewsBuyersOnly")}</p>
        )}
      </section>
    </div>
  );
}
