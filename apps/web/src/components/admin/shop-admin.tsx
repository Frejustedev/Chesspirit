"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Field, Input, Select } from "@/components/ui/form";
import {
  cancelOrderAction,
  savePromoAction,
  setOrderStatusAction,
  togglePromoAction,
} from "@/app/actions/shop";

export function ShopAdminNav({ current }: { current: string }) {
  const t = useTranslations("adminShop");
  const items = [
    ["/admin/boutique", t("orders")],
    ["/admin/boutique/produits", t("products")],
    ["/admin/boutique/codes", t("promos")],
  ] as const;
  return (
    <nav aria-label={t("title")} className="-mx-4 mt-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-line">
        {items.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={current === href ? "page" : undefined}
              className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 ${current === href ? "border-accent font-semibold text-accent" : "border-transparent hover:text-accent"}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const NEXT: Record<string, Record<string, string[]>> = {
  pickup: {
    paid: ["preparing", "ready_for_pickup"],
    preparing: ["ready_for_pickup"],
    ready_for_pickup: ["delivered"],
  },
  default: {
    paid: ["preparing", "shipped"],
    preparing: ["shipped"],
    shipped: ["delivered"],
  },
};

export function OrderStatusForm({
  orderId,
  status,
  delivery,
}: {
  orderId: string;
  status: string;
  delivery: string;
}) {
  const t = useTranslations("adminShop");
  const ts = useTranslations("shop");
  const router = useRouter();
  const options = [
    ...((NEXT[delivery === "pickup" ? "pickup" : "default"] ?? {})[status] ?? []),
    ...(["paid", "preparing", "ready_for_pickup", "shipped", "delivered"].includes(status)
      ? ["refunded"]
      : []),
  ];
  const [next, setNext] = useState(options[0] ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancellable = ["pending_payment", "paid", "preparing", "ready_for_pickup"].includes(status);
  if (!options.length && !cancellable) return null;
  return (
    <div className="space-y-3 rounded-lg border border-line p-4">
      {options.length ? (
        <>
          <Field id="next-status" label={t("nextStatus")}>
            <Select id="next-status" value={next} onChange={(e) => setNext(e.target.value)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {ts(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="status-note" label={t("note")} optional={t("optional")}>
            <Input
              id="status-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button
            disabled={pending || !next}
            onClick={() =>
              start(async () => {
                const r = await setOrderStatusAction(orderId, next, note);
                if (r.ok) {
                  setNote("");
                  router.refresh();
                } else setError(r.error);
              })
            }
          >
            {t("update")}
          </Button>
        </>
      ) : null}
      {cancellable ? (
        <button
          type="button"
          disabled={pending}
          className="block min-h-11 text-sm font-semibold text-accent hover:underline"
          onClick={() => {
            if (!confirm(t("cancelConfirm"))) return;
            start(async () => {
              const r = await cancelOrderAction(orderId, note);
              if (r.ok) router.refresh();
              else setError(r.error);
            });
          }}
        >
          {t("cancelOrder")}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PromoForm() {
  const t = useTranslations("adminShop");
  const [state, action, pending] = useActionState(savePromoAction, null);
  const [kind, setKind] = useState("percent");
  return (
    <form action={action} className="h-fit space-y-4 rounded-lg border border-line p-5">
      <h2 className="font-display text-2xl font-semibold">{t("newPromo")}</h2>
      <Field id="p-code" label={t("code")}>
        <Input
          id="p-code"
          name="code"
          required
          pattern="[A-Za-z0-9-]{3,32}"
          className="uppercase"
        />
      </Field>
      <Field id="p-kind" label={t("kind")}>
        <Select id="p-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="percent">{t("kinds.percent")}</option>
          <option value="amount">{t("kinds.amount")}</option>
          <option value="free_shipping">{t("freeShipping")}</option>
        </Select>
      </Field>
      {kind !== "free_shipping" ? (
        <Field id="p-value" label={kind === "percent" ? t("percent") : t("amountXof")}>
          <Input
            id="p-value"
            name="value"
            type="number"
            min={1}
            max={kind === "percent" ? 100 : undefined}
            required
          />
        </Field>
      ) : (
        <input type="hidden" name="value" value="0" />
      )}
      <Field id="p-min" label={t("minSubtotal")} optional={t("optional")}>
        <Input id="p-min" name="minSubtotal" type="number" min={0} defaultValue={0} />
      </Field>
      <Field id="p-max" label={t("maxUses")} optional={t("optional")}>
        <Input id="p-max" name="maxUses" type="number" min={1} />
      </Field>
      <Field id="p-end" label={t("endsAt")} optional={t("optional")}>
        <Input id="p-end" name="endsAt" type="date" />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("create")}
      </Button>
      {state ? (
        <p role="status" className="text-sm font-semibold">
          {state.ok
            ? t("saved")
            : t(`errors.${state.error === "code_taken" ? "code_taken" : "invalid"}`)}
        </p>
      ) : null}
    </form>
  );
}

export function PromoToggle({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("adminShop");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={active}
      className={`min-h-10 rounded-full px-3 text-sm font-semibold ${active ? "bg-gold text-onaccent" : "border border-line"}`}
      onClick={() =>
        start(async () => {
          await togglePromoAction(id, !active);
          router.refresh();
        })
      }
    >
      {active ? t("active") : t("inactive")}
    </button>
  );
}
