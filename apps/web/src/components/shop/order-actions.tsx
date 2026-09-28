"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { cancelOrderAction, payOrderAction } from "@/app/actions/shop";

export function OrderActions({ orderId }: { orderId: string }) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await payOrderAction(orderId);
            if (r.ok) window.location.assign(r.data!.redirect);
            else setError(t("errors.payment"));
          })
        }
      >
        {t("payNow")}
      </Button>
      <button
        type="button"
        disabled={pending}
        className="min-h-11 rounded-full border border-fg/25 px-4 font-semibold hover:bg-surface"
        onClick={() => {
          if (!confirm(t("cancelConfirm"))) return;
          start(async () => {
            const r = await cancelOrderAction(orderId);
            if (r.ok) router.refresh();
            else setError(t("errors.cancel"));
          });
        }}
      >
        {t("cancelOrder")}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
