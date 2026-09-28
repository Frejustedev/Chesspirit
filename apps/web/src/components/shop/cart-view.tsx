"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { useCart, type CartLine } from "@/lib/shop/cart";
import { cartDetailsAction, type CartDetail } from "@/app/actions/shop";
import { ProductArt } from "@/components/shop/product-art";
import type { Json } from "@/lib/supabase/types";

function trc(v: Json, locale: string) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "";
  const o = v as Record<string, string>;
  return o[locale] ?? o.fr ?? "";
}

/** Charge les détails à jour (prix, stock) des lignes du panier. */
export function useCartDetails(lines: CartLine[]) {
  const [details, setDetails] = useState<Record<string, CartDetail> | null>(null);
  const key = [...new Set(lines.map((l) => l.variantId))].sort().join(",");
  useEffect(() => {
    let cancelled = false;
    cartDetailsAction(key ? key.split(",") : []).then((d) => {
      if (!cancelled) setDetails(Object.fromEntries(d.map((x) => [x.variantId, x])));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return details;
}

export function lineIssue(l: CartLine, d: CartDetail | undefined) {
  if (!d || !d.available) return "unavailable";
  if (d.kind === "physical" && !d.isPreorder && d.stock < l.quantity)
    return d.stock ? "stock" : "soldOut";
  return null;
}

export function CartView() {
  const t = useTranslations("shop");
  const locale = useLocale();
  const cart = useCart();
  const details = useCartDetails(cart.lines);
  if (!cart.lines.length)
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center">
        <p className="font-serif text-xl text-stone">{t("cartEmpty")}</p>
        <Link
          href="/boutique"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-bordeaux px-5 font-semibold text-cream hover:bg-bordeaux-bright"
        >
          {t("continue")}
        </Link>
      </div>
    );
  if (!details) return <p className="text-stone">{t("loading")}</p>;
  const subtotal = cart.lines.reduce(
    (s, l) => s + (details[l.variantId]?.unitXof ?? 0) * l.quantity,
    0,
  );
  const blocked = cart.lines.some((l) => lineIssue(l, details[l.variantId]));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="divide-y divide-line border-y border-line">
        {cart.lines.map((l, i) => {
          const d = details[l.variantId];
          const issue = lineIssue(l, d);
          const name = d ? trc(d.name, locale) : t("unavailable");
          const vname = d ? trc(d.variantName, locale) : "";
          return (
            <li key={`${l.variantId}-${i}`} className="flex gap-3 py-4">
              <div className="w-20 shrink-0 overflow-hidden rounded-md border border-line sm:w-24">
                {d ? (
                  <ProductArt art={d.art} imageUrl={d.imageUrl} alt="" className="w-full" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {d ? (
                    <Link href={`/boutique/produit/${d.productSlug}`} className="hover:text-accent">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                {vname ? <p className="text-sm text-stone">{vname}</p> : null}
                {l.gift?.recipient_name ? (
                  <p className="text-sm text-stone">
                    {t("giftFor")} : {l.gift.recipient_name}
                  </p>
                ) : null}
                {d?.isPreorder ? <p className="text-sm font-semibold">{t("preorder")}</p> : null}
                {issue ? (
                  <p className="text-sm font-semibold text-accent">
                    {t(`issue.${issue}`, { n: d?.stock ?? 0 })}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="sr-only" htmlFor={`q-${i}`}>
                    {t("quantity")}
                  </label>
                  <input
                    id={`q-${i}`}
                    type="number"
                    min={1}
                    max={50}
                    value={l.quantity}
                    onChange={(e) => cart.setQuantity(i, Number(e.target.value) || 1)}
                    className="tabular min-h-11 w-20 rounded-md border border-line bg-field px-3"
                  />
                  <button
                    type="button"
                    onClick={() => cart.remove(i)}
                    className="min-h-11 text-sm font-semibold text-accent hover:underline"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
              <p className="tabular shrink-0 font-semibold">
                {d ? formatXof(d.unitXof * l.quantity, locale) : "—"}
              </p>
            </li>
          );
        })}
      </ul>
      <aside className="h-fit rounded-lg border border-line p-5">
        <p className="flex justify-between text-lg">
          <span>{t("subtotal")}</span>
          <span className="tabular font-semibold">{formatXof(subtotal, locale)}</span>
        </p>
        <p className="mt-2 text-sm text-stone">{t("shippingLater")}</p>
        {blocked ? (
          <p className="mt-4 text-sm font-semibold text-accent">{t("fixCart")}</p>
        ) : (
          <Link
            href="/boutique/commande"
            className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-bordeaux px-5 font-semibold text-cream hover:bg-bordeaux-bright"
          >
            {t("checkout")}
          </Link>
        )}
        <Link
          href="/boutique"
          className="mt-3 flex min-h-11 items-center justify-center font-semibold text-fg/80 hover:text-accent"
        >
          {t("continue")}
        </Link>
      </aside>
    </div>
  );
}
