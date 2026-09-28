"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { startPayment } from "@/lib/payments/checkout";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { orderConfirmation } from "@/lib/shop/notify";
import type { Json } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();

const giftSchema = z
  .object({
    recipient_name: z.string().trim().max(80).optional(),
    recipient_contact: z.string().trim().max(120).optional(),
    message: z.string().trim().max(500).optional(),
  })
  .optional();
const linesSchema = z
  .array(z.object({ variantId: uuid, quantity: z.number().int().min(1).max(50), gift: giftSchema }))
  .max(30);

export type CartDetail = {
  variantId: string;
  productSlug: string;
  kind: string;
  name: Json;
  variantName: Json;
  art: string;
  imageUrl: string | null;
  unitXof: number;
  stock: number;
  isPreorder: boolean;
  available: boolean;
};

/** Détails à jour des lignes du panier (prix et disponibilité depuis la base). */
export async function cartDetailsAction(variantIds: string[]): Promise<CartDetail[]> {
  const ids = [...new Set(variantIds)].filter((id) => uuid.safeParse(id).success).slice(0, 30);
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select(
      "id, name, price_xof, stock, is_active, products!inner(slug, kind, name, price_xof, art, image_url, is_preorder, is_active)",
    )
    .in("id", ids);
  return (data ?? []).map((v) => ({
    variantId: v.id,
    productSlug: v.products.slug,
    kind: v.products.kind,
    name: v.products.name,
    variantName: v.name,
    art: v.products.art,
    imageUrl: v.products.image_url,
    unitXof: v.price_xof ?? v.products.price_xof,
    stock: v.stock,
    isPreorder: v.products.is_preorder,
    available: v.is_active && v.products.is_active,
  }));
}

export async function checkPromoAction(
  code: string,
  subtotal: number,
): Promise<Result<{ kind: string; discount: number }>> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(c) || !Number.isInteger(subtotal) || subtotal < 0)
    return { ok: false, error: "invalid_promo" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("check_promo", { p_code: c, p_subtotal: subtotal });
  const r = data?.[0];
  if (!r?.valid) return { ok: false, error: "invalid_promo" };
  return { ok: true, data: { kind: r.kind!, discount: r.discount_xof } };
}

export async function giftCardBalanceAction(code: string): Promise<Result<number>> {
  const c = code.trim().toUpperCase();
  if (!/^CAD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c))
    return { ok: false, error: "invalid_gift_card" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("gift_card_balance", { p_code: c });
  return typeof data === "number" && data > 0
    ? { ok: true, data }
    : { ok: false, error: "invalid_gift_card" };
}

const checkoutSchema = z.object({
  lines: linesSchema.min(1),
  delivery: z.enum(["pickup", "cotonou", "subregion"]),
  address: z
    .object({
      line: z.string().trim().max(200).optional(),
      city: z.string().trim().max(80).optional(),
      country: z.string().trim().max(60).optional(),
    })
    .default({}),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  promo: z.string().trim().max(32).optional(),
  giftCode: z.string().trim().max(32).optional(),
  usePoints: z.number().int().min(0).max(10_000_000).default(0),
  notes: z.string().trim().max(1000).optional(),
});

/** Passe la commande puis ouvre le paiement (montant calculé par la base). */
export async function placeOrderAction(
  raw: unknown,
): Promise<Result<{ redirect: string; number: string }>> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = checkoutSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const v = p.data;
  if (!(await onlinePaymentsEnabled())) return { ok: false, error: "payment" };
  const supabase = await createClient();
  const { data: order, error } = await supabase.rpc("place_order", {
    p_items: v.lines.map((l) => ({
      variant_id: l.variantId,
      quantity: l.quantity,
      gift: l.gift ?? null,
    })) as unknown as Json,
    p_delivery: v.delivery,
    p_address: v.address as Json,
    p_contact_name: v.contactName,
    p_contact_phone: v.contactPhone,
    p_contact_email: v.contactEmail || undefined,
    p_promo: v.promo || undefined,
    p_gift_code: v.giftCode || undefined,
    p_use_points: v.usePoints,
    p_notes: v.notes || undefined,
  });
  if (error || !order) {
    const known = [
      "out_of_stock",
      "product_unavailable",
      "invalid_promo",
      "invalid_gift_card",
      "address_required",
      "invalid_contact",
      "empty_cart",
    ];
    const msg = error?.message ?? "server";
    return { ok: false, error: known.includes(msg) ? msg : "server" };
  }
  revalidatePath("/compte/commandes");
  if (order.status !== "pending_payment") {
    await orderConfirmation(order.id);
    return {
      ok: true,
      data: { redirect: `/compte/commandes/${order.number}`, number: order.number },
    };
  }
  try {
    const url = await startPayment({
      objectType: "order",
      objectId: order.id,
      amountXof: order.total_xof,
      description: `Commande ${order.number}`,
      userId: session.userId,
      payer: {
        profileId: session.profile.id,
        firstName: session.profile.first_name,
        lastName: session.profile.last_name,
        email: v.contactEmail || session.profile.email,
        phone: v.contactPhone,
      },
    });
    return { ok: true, data: { redirect: url, number: order.number } };
  } catch {
    return {
      ok: true,
      data: { redirect: `/compte/commandes/${order.number}`, number: order.number },
    };
  }
}

/** Reprise du paiement d'une commande en attente. */
export async function payOrderAction(orderId: string): Promise<Result<{ redirect: string }>> {
  const session = await getSession();
  if (!session?.profile || !uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("id, number, status, total_xof, contact_phone, contact_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!o || o.status !== "pending_payment") return { ok: false, error: "invalid" };
  try {
    const url = await startPayment({
      objectType: "order",
      objectId: o.id,
      amountXof: o.total_xof,
      description: `Commande ${o.number}`,
      userId: session.userId,
      payer: {
        profileId: session.profile.id,
        firstName: session.profile.first_name,
        lastName: session.profile.last_name,
        email: o.contact_email ?? session.profile.email,
        phone: o.contact_phone,
      },
    });
    return { ok: true, data: { redirect: url } };
  } catch {
    return { ok: false, error: "payment_unavailable" };
  }
}

export async function cancelOrderAction(orderId: string, note?: string): Promise<Result> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_note: note?.slice(0, 500) || undefined,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/commandes");
  revalidatePath("/admin/boutique");
  return { ok: true };
}

export async function toggleWishlistAction(productId: string): Promise<Result<boolean>> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (!uuid.safeParse(productId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("profile_id", session.profile.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("wishlists")
      .delete()
      .eq("profile_id", session.profile.id)
      .eq("product_id", productId);
  } else {
    const { error } = await supabase
      .from("wishlists")
      .insert({ profile_id: session.profile.id, product_id: productId });
    if (error) return { ok: false, error: "server" };
  }
  revalidatePath("/compte/commandes");
  return { ok: true, data: !existing };
}

const reviewSchema = z.object({
  productId: uuid,
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});

export async function reviewAction(raw: unknown): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = reviewSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_reviews").upsert(
    {
      product_id: p.data.productId,
      profile_id: session.profile.id,
      rating: p.data.rating,
      body: p.data.body || null,
    },
    { onConflict: "product_id,profile_id" },
  );
  if (error) return { ok: false, error: "review_not_allowed" };
  revalidatePath("/boutique", "layout");
  return { ok: true };
}

export type TrackResult = {
  number: string;
  status: string;
  delivery_method: string;
  created_at: string;
  events: { status: string; note: string | null; at: string }[];
};

export async function trackOrderAction(
  _prev: unknown,
  form: FormData,
): Promise<Result<TrackResult> | null> {
  const number = String(form.get("number") ?? "")
    .trim()
    .toUpperCase();
  const phone = String(form.get("phone") ?? "").trim();
  if (!/^CS-\d{4}-\d{3,}$/.test(number) || phone.replace(/\D/g, "").length < 8)
    return { ok: false, error: "not_found" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("track_order", { p_number: number, p_phone: phone });
  const r = data?.[0];
  if (!r) return { ok: false, error: "not_found" };
  return { ok: true, data: r as unknown as TrackResult };
}

// ---------------------------------------------------------------------------
// Administration de la boutique (les droits sont vérifiés par la base).
// ---------------------------------------------------------------------------
const STATUSES = ["preparing", "ready_for_pickup", "shipped", "delivered", "refunded"] as const;

export async function setOrderStatusAction(
  orderId: string,
  status: string,
  note?: string,
): Promise<Result> {
  if (!uuid.safeParse(orderId).success || !(STATUSES as readonly string[]).includes(status))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: orderId,
    p_status: status as (typeof STATUSES)[number],
    p_note: note?.slice(0, 500) || undefined,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/boutique", "layout");
  return { ok: true };
}

const i18nText = z.object({ fr: z.string().trim().max(4000), en: z.string().trim().max(4000) });
const productSchema = z.object({
  id: uuid.optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80),
  categoryId: uuid.nullable(),
  kind: z.enum(["physical", "gift_card"]),
  name: i18nText.refine((n) => n.fr.length >= 2),
  description: i18nText,
  priceXof: z.number().int().min(0).max(100_000_000),
  compareAtXof: z.number().int().min(0).max(100_000_000).nullable(),
  art: z.string().max(40),
  imageUrl: z
    .string()
    .trim()
    .regex(/^(https:\/\/|\/)\S+$/)
    .max(500)
    .nullable()
    .or(z.literal("").transform(() => null)),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isPreorder: z.boolean(),
  preorderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  variants: z
    .array(
      z.object({
        id: uuid.optional(),
        name: i18nText,
        sku: z.string().trim().max(60).nullable(),
        priceXof: z.number().int().min(0).nullable(),
        stock: z.number().int().min(0).max(1_000_000),
        isActive: z.boolean(),
      }),
    )
    .min(1)
    .max(40),
});

export async function saveProductAction(raw: unknown): Promise<Result<{ id: string }>> {
  const p = productSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const v = p.data;
  const supabase = await createClient();
  const row = {
    slug: v.slug,
    category_id: v.categoryId,
    kind: v.kind,
    name: v.name,
    description: v.description,
    price_xof: v.priceXof,
    compare_at_xof: v.compareAtXof,
    art: v.art,
    image_url: v.imageUrl,
    is_active: v.isActive,
    is_featured: v.isFeatured,
    is_preorder: v.isPreorder,
    preorder_date: v.isPreorder ? v.preorderDate : null,
  };
  const { data: prod, error } = v.id
    ? await supabase.from("products").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();
  if (error || !prod)
    return { ok: false, error: error?.code === "23505" ? "slug_taken" : "forbidden" };
  for (const [i, va] of v.variants.entries()) {
    const vr = {
      product_id: prod.id,
      name: va.name,
      sku: va.sku || null,
      price_xof: va.priceXof,
      stock: va.stock,
      is_active: va.isActive,
      position: i,
    };
    const { error: e } = va.id
      ? await supabase.from("product_variants").update(vr).eq("id", va.id).eq("product_id", prod.id)
      : await supabase.from("product_variants").insert(vr);
    if (e) return { ok: false, error: e.code === "23505" ? "sku_taken" : "server" };
  }
  revalidatePath("/boutique", "layout");
  revalidatePath("/admin/boutique", "layout");
  return { ok: true, data: { id: prod.id } };
}

const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,32}$/),
  kind: z.enum(["percent", "amount", "free_shipping"]),
  value: z.coerce.number().int().min(0).max(100_000_000),
  minSubtotal: z.coerce.number().int().min(0).default(0),
  maxUses: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  endsAt: z.string().optional(),
});

export async function savePromoAction(_prev: unknown, form: FormData): Promise<Result | null> {
  const p = promoSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const v = p.data;
  if (v.kind === "percent" && (v.value < 1 || v.value > 100))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").insert({
    code: v.code,
    kind: v.kind,
    value: v.kind === "free_shipping" ? 0 : v.value,
    min_subtotal_xof: v.minSubtotal,
    max_uses: v.maxUses ?? null,
    ends_at: v.endsAt ? new Date(v.endsAt).toISOString() : null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "code_taken" : "forbidden" };
  revalidatePath("/admin/boutique/codes");
  return { ok: true };
}

export async function togglePromoAction(id: string, active: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/boutique/codes");
  return { ok: true };
}
