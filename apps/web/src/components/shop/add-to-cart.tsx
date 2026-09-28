"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { Button, Field, Input } from "@/components/ui/form";
import { useCart } from "@/lib/shop/cart";

type Variant = { id: string; name: string; price: number; stock: number };

export function AddToCart({
  variants,
  compareAt,
  isGiftCard,
  tracksStock,
}: {
  variants: Variant[];
  compareAt: number | null;
  isGiftCard: boolean;
  tracksStock: boolean;
}) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const cart = useCart();
  const firstAvailable = variants.find((v) => !tracksStock || v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const [gift, setGift] = useState({ recipient_name: "", recipient_contact: "", message: "" });
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.id === variantId);
  if (!v) return <p className="text-stone">{t("unavailable")}</p>;
  const soldOut = tracksStock && v.stock <= 0;
  const max = tracksStock ? Math.min(50, v.stock) : 50;
  return (
    <div className="space-y-4">
      <p className="tabular font-display text-3xl font-semibold">
        {formatXof(v.price, locale)}
        {compareAt && compareAt > v.price ? (
          <s className="ml-3 text-lg text-stone">{formatXof(compareAt, locale)}</s>
        ) : null}
      </p>
      {variants.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-semibold">
            {isGiftCard ? t("amount") : t("variant")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((x) => {
              const out = tracksStock && x.stock <= 0;
              return (
                <label
                  key={x.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[0.95rem] font-semibold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-cream has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-bordeaux ${out ? "border-line text-stone line-through" : "border-line"}`}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={x.id}
                    checked={x.id === variantId}
                    onChange={() => {
                      setVariantId(x.id);
                      setQty(1);
                    }}
                    className="sr-only"
                  />
                  {x.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {tracksStock ? (
        <p className={`text-sm ${soldOut ? "text-bordeaux" : "text-stone"}`}>
          {soldOut ? t("soldOut") : v.stock <= 3 ? t("lowStock", { n: v.stock }) : t("inStock")}
        </p>
      ) : null}
      {isGiftCard ? (
        <fieldset className="space-y-3 rounded-md border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{t("giftFor")}</legend>
          <Field id="g-name" label={t("giftName")}>
            <Input
              id="g-name"
              value={gift.recipient_name}
              maxLength={80}
              onChange={(e) => setGift({ ...gift, recipient_name: e.target.value })}
            />
          </Field>
          <Field id="g-contact" label={t("giftContact")}>
            <Input
              id="g-contact"
              value={gift.recipient_contact}
              maxLength={120}
              onChange={(e) => setGift({ ...gift, recipient_contact: e.target.value })}
            />
          </Field>
          <Field id="g-msg" label={t("giftMessage")}>
            <Input
              id="g-msg"
              value={gift.message}
              maxLength={500}
              onChange={(e) => setGift({ ...gift, message: e.target.value })}
            />
          </Field>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="qty" className="block text-sm font-semibold">
            {t("quantity")}
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            max={max}
            value={qty}
            disabled={soldOut}
            onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
            className="tabular mt-1 min-h-11 w-20 rounded-md border border-line bg-white px-3"
          />
        </div>
        <Button
          type="button"
          disabled={soldOut}
          onClick={() => {
            cart.add(v.id, qty, isGiftCard ? gift : undefined);
            setAdded(true);
          }}
        >
          {t("addToCart")}
        </Button>
      </div>
      {added ? (
        <p role="status" className="rounded bg-gold-soft/60 px-3 py-2 text-sm font-semibold">
          {t("added")}{" "}
          <Link href="/boutique/panier" className="text-bordeaux underline">
            {t("seeCart")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
