"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  refundAction,
  saveAppSettingAction,
  setContactStatusAction,
  setDataRequestStatusAction,
  setFeatureFlagAction,
  setQuoteStatusAction,
} from "@/app/actions/admin-users";

const OPTIONS = {
  contact: ["new", "answered", "archived"],
  data: ["pending", "processing", "done", "refused"],
  quote: ["new", "in_progress", "sent", "won", "lost"],
} as const;

export function StatusSelect({
  kind,
  id,
  value,
}: {
  kind: keyof typeof OPTIONS;
  id: string;
  value: string;
}) {
  const t = useTranslations("adminMessages");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      <label htmlFor={`st-${id}`} className="sr-only">
        {t("status")}
      </label>
      <select
        id={`st-${id}`}
        defaultValue={value}
        disabled={pending}
        className="min-h-10 rounded-md border border-line bg-white px-2 text-sm"
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            if (kind === "contact")
              await setContactStatusAction(id, v as "new" | "answered" | "archived");
            else if (kind === "data")
              await setDataRequestStatusAction(id, v as "processing" | "done" | "refused");
            else
              await setQuoteStatusAction(id, v as "new" | "in_progress" | "sent" | "won" | "lost");
            router.refresh();
          });
        }}
      >
        {OPTIONS[kind].map((o) => (
          <option key={o} value={o} disabled={kind === "data" && o === "pending"}>
            {t(`statuses.${o}`)}
          </option>
        ))}
      </select>
    </>
  );
}

export function RefundButton({ paymentId, max }: { paymentId: string; max: number }) {
  const t = useTranslations("adminPayments");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold hover:bg-cream"
      onClick={() => {
        const raw = prompt(t("refundAmount", { max }), String(max));
        if (!raw) return;
        const amount = Math.round(Number(raw));
        if (!Number.isInteger(amount) || amount < 1 || amount > max) return;
        const reason = prompt(t("refundReason")) ?? "";
        start(async () => {
          const r = await refundAction(paymentId, amount, reason);
          if (!r.ok) alert(t("refundError"));
          router.refresh();
        });
      }}
    >
      {t("refund")}
    </button>
  );
}

export function FlagToggle({
  flag,
  enabled,
  disabled,
}: {
  flag: string;
  enabled: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("adminSettings");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      disabled={disabled || pending}
      className={`min-h-10 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${enabled ? "bg-ink text-cream" : "border border-line"}`}
      onClick={() =>
        start(async () => {
          await setFeatureFlagAction(flag, !enabled);
          router.refresh();
        })
      }
    >
      {enabled ? t("on") : t("off")}
    </button>
  );
}

export function SettingEditor({
  settingKey,
  value,
  disabled,
}: {
  settingKey: string;
  value: string;
  disabled: boolean;
}) {
  const t = useTranslations("adminSettings");
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAppSettingAction(settingKey, v);
          setMsg(r.ok ? t("saved") : r.error === "invalid_json" ? t("invalidJson") : t("error"));
        });
      }}
    >
      <label htmlFor={`set-${settingKey}`} className="sr-only">
        {settingKey}
      </label>
      <input
        id={`set-${settingKey}`}
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-white px-3 font-mono text-sm"
      />
      <button
        type="submit"
        disabled={disabled || pending || v === value}
        className="min-h-10 rounded-full bg-ink px-4 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {t("save")}
      </button>
      {msg ? (
        <span role="status" className="self-center text-sm font-semibold">
          {msg}
        </span>
      ) : null}
    </form>
  );
}
