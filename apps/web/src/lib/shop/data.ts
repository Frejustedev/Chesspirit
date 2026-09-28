import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export type ProductCard = {
  id: string;
  slug: string;
  kind: string;
  name: Json;
  price_xof: number;
  compare_at_xof: number | null;
  art: string;
  image_url: string | null;
  is_preorder: boolean;
  is_featured: boolean;
  is_demo: boolean;
  rating_avg: number | null;
  reviews_count: number;
  created_at: string;
  product_categories: { slug: string; name: Json } | null;
  product_variants: { id: string; stock: number; price_xof: number | null; is_active: boolean }[];
};

const CARD =
  "id, slug, kind, name, price_xof, compare_at_xof, art, image_url, is_preorder, is_featured, is_demo, rating_avg, reviews_count, created_at, product_categories(slug, name), product_variants(id, stock, price_xof, is_active)";

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_categories")
    .select("id, slug, name, description")
    .eq("is_active", true)
    .order("position");
  return data ?? [];
}

export async function getProducts(opts: {
  category?: string;
  sort?: string;
  featured?: boolean;
  q?: string;
}) {
  const supabase = await createClient();
  let q = supabase.from("products").select(CARD).eq("is_active", true);
  if (opts.featured) q = q.eq("is_featured", true);
  if (opts.sort === "price_asc") q = q.order("price_xof");
  else if (opts.sort === "price_desc") q = q.order("price_xof", { ascending: false });
  else if (opts.sort === "new") q = q.order("created_at", { ascending: false });
  else q = q.order("is_featured", { ascending: false }).order("created_at");
  const { data } = await q.limit(120);
  let rows = (data ?? []) as unknown as ProductCard[];
  if (opts.category) rows = rows.filter((p) => p.product_categories?.slug === opts.category);
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    rows = rows.filter((p) => JSON.stringify(p.name).toLowerCase().includes(needle));
  }
  return rows;
}

export function priceRange(p: ProductCard) {
  const prices = p.product_variants
    .filter((v) => v.is_active)
    .map((v) => v.price_xof ?? p.price_xof);
  return prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : { min: p.price_xof, max: p.price_xof };
}

export function inStock(p: ProductCard) {
  return (
    p.kind !== "physical" ||
    p.is_preorder ||
    p.product_variants.some((v) => v.is_active && v.stock > 0)
  );
}

export async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, slug, kind, name, description, price_xof, compare_at_xof, art, image_url, is_preorder, preorder_date, is_demo, rating_avg, reviews_count, category_id, product_categories(slug, name), product_variants(id, name, price_xof, stock, position, is_active)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getShopSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").like("key", "shop_%");
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    cotonou: Number(m.shop_shipping_cotonou_xof ?? 0),
    subregion: Number(m.shop_shipping_subregion_xof ?? 0),
    freeFrom: m.shop_free_shipping_from_xof == null ? null : Number(m.shop_free_shipping_from_xof),
    pickup: typeof m.shop_pickup_address === "string" ? m.shop_pickup_address : "À confirmer",
    pointsPer100: Number(m.shop_loyalty_points_per_100_xof ?? 0),
    pointValue: Number(m.shop_loyalty_point_value_xof ?? 1),
  };
}
