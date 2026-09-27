"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { Button, Field, Input } from "@/components/ui/form";
import { useCart } from "@/lib/shop/cart";
import { useCartDetails, lineIssue } from "@/components/shop/cart-view";
import { checkPromoAction, giftCardBalanceAction, placeOrderAction } from "@/app/actions/shop";

type Settings = {
  cotonou: number;
  subregion: number;
  freeFrom: number | null;
  pickup: string;
  pointValue: number;
};

export function CheckoutForm({
  settings,
  points,
  defaults,
}: {
  settings: Settings;
  points: number;
  defaults: { name: string; phone: string; email: string; city: string };
}) {
  const t = useTranslations("shop");
  const te = useTranslations("errors");
  const locale = useLocale();
  const cart = useCart();
  const details = useCartDetails(cart.lines);
  const [delivery, setDelivery] = useState<"pickup" | "cotonou" | "subregion">("pickup");
  const [contact, setContact] = useState({
    name: defaults.name,
    phone: defaults.phone,
    email: defaults.email,
  });
  const [address, setAddress] = useState({
    line: "",
    city: defaults.city || "Cotonou",
    country: "",
  });
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; kind: string; discount: number } | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [gift, setGift] = useState<{ code: string; balance: number } | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!cart.lines.length)
    return (
      <p className="font-serif text-xl text-stone">
        {t("cartEmpty")}{" "}
        <Link href="/boutique" className="text-bordeaux underline">
          {t("continue")}
        </Link>
      </p>
    );
  if (!details) return <p className="text-stone">{t("loading")}</p>;

  const physical = cart.lines.some((l) => details[l.variantId]?.kind === "physical");
  const subtotal = cart.lines.reduce(
    (s, l) => s + (details[l.variantId]?.unitXof ?? 0) * l.quantity,
    0,
  );
  // Les cartes cadeaux ne sont ni remisées ni payables en points (règle appliquée aussi en base).
  const giftSubtotal = cart.lines.reduce(
    (s, l) =>
      s +
      (details[l.variantId]?.kind === "gift_card"
        ? (details[l.variantId]?.unitXof ?? 0) * l.quantity
        : 0),
    0,
  );
  const discount = promo ? Math.min(promo.discount, subtotal - giftSubtotal) : 0;
  const shipping =
    !physical || delivery === "pickup" || promo?.kind === "free_shipping"
      ? 0
      : delivery === "cotonou"
        ? settings.freeFrom !== null && subtotal - discount >= settings.freeFrom
          ? 0
          : settings.cotonou
        : settings.subregion;
  let remaining = subtotal - discount + shipping;
  const giftUsed = gift ? Math.min(gift.balance, remaining) : 0;
  remaining -= giftUsed;
  const pts = usePoints
    ? Math.max(
        0,
        Math.min(
          points,
          Math.floor(Math.max(0, remaining - giftSubtotal) / Math.max(1, settings.pointValue)),
        ),
      )
    : 0;
  remaining -= pts * settings.pointValue;
  const blocked = cart.lines.some((l) => lineIssue(l, details[l.variantId]));

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : te.has(code) ? te(code) : te("server");

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1fr_22rem]"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await placeOrderAction({
            lines: cart.lines,
            delivery: physical ? delivery : "pickup",
            address: delivery === "pickup" ? {} : address,
            contactName: contact.name,
            contactPhone: contact.phone,
            contactEmail: contact.email,
            promo: promo?.code,
            giftCode: gift?.code,
            usePoints: pts,
            notes,
          });
          if (!r.ok) {
            setError(errorText(r.error));
            return;
          }
          cart.clear();
          window.location.assign(r.data!.redirect);
        });
      }}
    >
      <div className="space-y-8">
        {physical ? (
          <fieldset>
            <legend className="font-display text-2xl font-semibold">{t("delivery")}</legend>
            <div className="mt-3 grid gap-2">
              {(
                [
                  ["pickup", t("pickup"), 0, t("pickupAt", { address: settings.pickup })],
                  [
                    "cotonou",
                    t("cotonou"),
                    settings.cotonou,
                    settings.freeFrom
                      ? t("perkFree", { from: formatXof(settings.freeFrom, locale) })
                      : "",
                  ],
                  ["subregion", t("subregion"), settings.subregion, t("subregionNote")],
                ] as const
              ).map(([k, label, fee, note]) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-cream"
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={k}
                    checked={delivery === k}
                    onChange={() => setDelivery(k)}
                    className="mt-1 size-5 accent-[var(--color-bordeaux)]"
                  />
                  <span className="flex-1">
                    <span className="block font-semibold">{label}</span>
                    {note ? <span className="block text-sm text-stone">{note}</span> : null}
                  </span>
                  <span className="tabular font-semibold">
                    {fee ? formatXof(fee, locale) : t("free")}
                  </span>
                </label>
              ))}
            </div>
            {delivery !== "pickup" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field id="addr" label={t("address")}>
                    <Input
                      id="addr"
                      required
                      autoComplete="street-address"
                      value={address.line}
                      maxLength={200}
                      onChange={(e) => setAddress({ ...address, line: e.target.value })}
                    />
                  </Field>
                </div>
                <Field id="addr-city" label={t("city")}>
                  <Input
                    id="addr-city"
                    autoComplete="address-level2"
                    value={address.city}
                    maxLength={80}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  />
                </Field>
                {delivery === "subregion" ? (
                  <Field id="addr-country" label={t("country")}>
                    <Input
                      id="addr-country"
                      autoComplete="country-name"
                      value={address.country}
                      maxLength={60}
                      onChange={(e) => setAddress({ ...address, country: e.target.value })}
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-display text-2xl font-semibold">{t("contact")}</legend>
          <Field id="c-name" label={t("contactName")}>
            <Input
              id="c-name"
              required
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
            />
          </Field>
          <Field id="c-phone" label={t("contactPhone")} hint={t("contactPhoneHint")}>
            <Input
              id="c-phone"
              type="tel"
              required
              autoComplete="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="c-email" label={t("contactEmail")} optional={t("optional")}>
              <Input
                id="c-email"
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-semibold">
              {t("notes")} <span className="font-normal text-stone">({t("optional")})</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white p-3"
            />
          </div>
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-display text-2xl font-semibold">{t("summary")}</h2>
        <div>
          <label htmlFor="promo" className="block text-sm font-semibold">
            {t("promo")}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="promo"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 uppercase"
            />
            <button
              type="button"
              className="min-h-11 rounded-full border border-ink/25 px-3 text-sm font-semibold hover:bg-cream"
              onClick={async () => {
                setError(null);
                const r = await checkPromoAction(promoInput, subtotal - giftSubtotal);
                if (r.ok) setPromo({ code: promoInput.trim(), ...r.data! });
                else {
                  setPromo(null);
                  setError(errorText(r.error));
                }
              }}
            >
              {t("applyCode")}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="giftcode" className="block text-sm font-semibold">
            {t("giftCard")}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="giftcode"
              value={giftInput}
              placeholder="CAD-XXXX-XXXX-XXXX"
              onChange={(e) => setGiftInput(e.target.value.toUpperCase())}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 uppercase"
            />
            <button
              type="button"
              className="min-h-11 rounded-full border border-ink/25 px-3 text-sm font-semibold hover:bg-cream"
              onClick={async () => {
                setError(null);
                const r = await giftCardBalanceAction(giftInput);
                if (r.ok) setGift({ code: giftInput.trim(), balance: r.data! });
                else {
                  setGift(null);
                  setError(errorText(r.error));
                }
              }}
            >
              {t("applyCode")}
            </button>
          </div>
        </div>
        {points > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="size-5 accent-[var(--color-bordeaux)]"
            />
            {t("usePoints", { n: points })}
          </label>
        ) : null}
        <dl className="space-y-1 border-t border-line pt-3 text-[0.95rem]">
          <Row label={t("subtotal")} value={formatXof(subtotal, locale)} />
          {discount ? (
            <Row
              label={`${t("discount")} (${promo!.code})`}
              value={`− ${formatXof(discount, locale)}`}
            />
          ) : null}
          {physical ? (
            <Row label={t("shipping")} value={shipping ? formatXof(shipping, locale) : t("free")} />
          ) : null}
          {giftUsed ? (
            <Row label={t("giftCard")} value={`− ${formatXof(giftUsed, locale)}`} />
          ) : null}
          {pts ? (
            <Row label={t("points")} value={`− ${formatXof(pts * settings.pointValue, locale)}`} />
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold">
            <dt>{t("total")}</dt>
            <dd className="tabular">{formatXof(remaining, locale)}</dd>
          </div>
        </dl>
        {error ? (
          <p
            role="alert"
            className="rounded bg-bordeaux-soft px-3 py-2 text-sm font-semibold text-bordeaux"
          >
            {error}
          </p>
        ) : null}
        {blocked ? <p className="text-sm font-semibold text-bordeaux">{t("fixCart")}</p> : null}
        <Button type="submit" disabled={pending || blocked} className="w-full">
          {pending
            ? t("placing")
            : remaining > 0
              ? t("pay", { total: formatXof(remaining, locale) })
              : t("confirmOrder")}
        </Button>
        <p className="text-xs text-stone">
          {t("termsNote")}{" "}
          <Link href="/legal/cgv" className="underline">
            {t("termsLink")}
          </Link>
        </p>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
