"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateRegistrationAction } from "@/app/actions/admin";

export function RegistrationActions({ id, status, payment }: { id: string; status: string; payment: string }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const act = (a: "paid" | "confirm" | "cancel" | "refuse") => start(async () => void (await updateRegistrationAction(id, a)));
  const btn = "min-h-9 rounded-full border border-line px-2.5 text-xs font-semibold hover:bg-cream disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-1" aria-busy={pending}>
      {payment === "due_on_site" || payment === "pending" ? (
        <button type="button" className={btn} disabled={pending} onClick={() => act("paid")}>
          {t("markPaid")}
        </button>
      ) : null}
      {status === "waitlisted" || status === "pending_validation" ? (
        <button type="button" className={btn} disabled={pending} onClick={() => act("confirm")}>
          {t("confirm")}
        </button>
      ) : null}
      {!["cancelled", "refused"].includes(status) ? (
        <button type="button" className={btn} disabled={pending} onClick={() => confirm(t("cancelConfirm")) && act("cancel")}>
          {t("cancel")}
        </button>
      ) : null}
    </div>
  );
}
