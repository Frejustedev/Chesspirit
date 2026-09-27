"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@chesspirit/shared";
import { Button, Field, Input } from "@/components/ui/form";
import { trackOrderAction } from "@/app/actions/shop";

export function TrackForm() {
  const t = useTranslations("shop");
  const locale = useLocale();
  const [state, action, pending] = useActionState(trackOrderAction, null);
  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="t-number" label={t("orderNumber")}>
          <Input
            id="t-number"
            name="number"
            required
            placeholder="CS-2026-1001"
            className="uppercase"
          />
        </Field>
        <Field id="t-phone" label={t("contactPhone")}>
          <Input id="t-phone" name="phone" type="tel" required autoComplete="tel" />
        </Field>
        <Button type="submit" disabled={pending}>
          {t("track")}
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="rounded bg-bordeaux-soft px-3 py-2 font-semibold text-bordeaux">
          {t("trackNotFound")}
        </p>
      ) : null}
      {state?.ok && state.data ? (
        <section className="rounded-lg border border-line p-5" aria-live="polite">
          <h2 className="font-display text-2xl font-semibold">
            {state.data.number} · {t(`status.${state.data.status}`)}
          </h2>
          <p className="text-sm text-stone">
            {t(`deliveryKind.${state.data.delivery_method}`)} ·{" "}
            {formatDateTime(state.data.created_at, locale)}
          </p>
          <ol className="mt-4 space-y-2">
            {state.data.events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular w-40 shrink-0 text-sm text-stone">
                  {formatDateTime(e.at, locale)}
                </span>
                <span className="font-semibold">
                  {t(`status.${e.status}`)}
                  {e.note && e.note !== "expired" ? (
                    <span className="font-normal text-stone"> — {e.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
