import { getTranslations } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";

type Order = {
  subtotal_xof: number;
  discount_xof: number;
  shipping_xof: number;
  gift_card_xof: number;
  loyalty_xof: number;
  total_xof: number;
  delivery_method: string;
  delivery_address: unknown;
  contact_name: string;
  contact_phone: string;
  notes: string | null;
  order_items: {
    id: string;
    name: string;
    variant_name: string | null;
    quantity: number;
    total_xof: number;
    is_preorder: boolean;
  }[];
};

export async function OrderSummary({ order: o, locale }: { order: Order; locale: string }) {
  const t = await getTranslations("shop");
  const addr = (o.delivery_address ?? {}) as { line?: string; city?: string; country?: string };
  const row = (label: string, value: number, minus = false) =>
    value ? (
      <div className="flex justify-between">
        <dt>{label}</dt>
        <dd className="tabular">
          {minus ? "− " : ""}
          {formatXof(value, locale)}
        </dd>
      </div>
    ) : null;
  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        {o.order_items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 py-2">
            <span>
              <span className="tabular">{i.quantity} ×</span> {i.name}
              {i.variant_name ? <span className="text-stone"> · {i.variant_name}</span> : null}
              {i.is_preorder ? (
                <span className="text-sm font-semibold"> · {t("preorder")}</span>
              ) : null}
            </span>
            <span className="tabular">{formatXof(i.total_xof, locale)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1">
        {row(t("subtotal"), o.subtotal_xof)}
        {row(t("discount"), o.discount_xof, true)}
        {row(t("shipping"), o.shipping_xof)}
        {row(t("giftCard"), o.gift_card_xof, true)}
        {row(t("points"), o.loyalty_xof, true)}
        <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold">
          <dt>{t("total")}</dt>
          <dd className="tabular">{formatXof(o.total_xof, locale)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-stone">
        {o.contact_name} · {o.contact_phone}
        {addr.line ? ` · ${[addr.line, addr.city, addr.country].filter(Boolean).join(", ")}` : ""}
      </p>
      {o.notes ? <p className="mt-1 text-sm text-stone">{o.notes}</p> : null}
    </div>
  );
}
