"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { checkInRowAction, updateRegistrationAction } from "@/app/actions/admin";

export function RegistrationActions({
  id,
  status,
  payment,
  ticket,
  checkedIn,
}: {
  id: string;
  status: string;
  payment: string;
  ticket?: string | null;
  checkedIn?: boolean;
}) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const act = (a: "paid" | "confirm" | "cancel" | "refuse") =>
    start(async () => void (await updateRegistrationAction(id, a)));
  const btn =
    "min-h-9 rounded-full border border-line px-2.5 text-xs font-semibold hover:bg-surface disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-1" aria-busy={pending}>
      {ticket && !checkedIn && status === "confirmed" ? (
        <button
          type="button"
          className={`${btn} border-gold/60 text-accent`}
          disabled={pending}
          onClick={() => start(async () => void (await checkInRowAction(ticket)))}
        >
          {t("checkInRow")}
        </button>
      ) : null}
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
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => confirm(t("cancelConfirm")) && act("cancel")}
        >
          {t("cancel")}
        </button>
      ) : null}
    </div>
  );
}
