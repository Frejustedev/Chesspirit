"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Input } from "@/components/ui/form";
import { approveApplicationAction, setCoachStatusAction } from "@/app/actions/coaching";
import { saveSettingAction } from "@/app/actions/admin";

export function ApplicationButtons({ id }: { id: string }) {
  const t = useTranslations("adminCoaching");
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (approve: boolean) =>
    start(async () => {
      await approveApplicationAction(id, approve);
      router.refresh();
    });
  return (
    <div className="mt-2 flex gap-2">
      <Button className="min-h-10 px-4 text-sm" disabled={pending} onClick={() => go(true)}>
        {t("approve")}
      </Button>
      <Button
        variant="secondary"
        className="min-h-10 px-4 text-sm"
        disabled={pending}
        onClick={() => go(false)}
      >
        {t("refuse")}
      </Button>
    </div>
  );
}

export function CoachStatus({ id, status, team }: { id: string; status: string; team: boolean }) {
  const t = useTranslations("adminCoaching");
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: "approved" | "suspended", tm: boolean) =>
    start(async () => {
      await setCoachStatusAction(id, s, tm);
      router.refresh();
    });
  return (
    <span className="flex items-center gap-3 text-sm">
      <Checkbox
        id={`team-${id}`}
        checked={team}
        disabled={pending}
        onChange={(e) => set(status === "suspended" ? "suspended" : "approved", e.target.checked)}
        label={t("team")}
      />
      <button
        type="button"
        disabled={pending}
        className="min-h-10 rounded-full border border-line px-3 font-semibold"
        onClick={() => set(status === "suspended" ? "approved" : "suspended", team)}
      >
        {status === "suspended" ? t("reactivate") : t("suspend")}
      </button>
    </span>
  );
}

export function CommissionSettings({
  enabled,
  rate,
  canEdit,
}: {
  enabled: boolean;
  rate: number;
  canEdit: boolean;
}) {
  const t = useTranslations("adminCoaching");
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [r, setR] = useState(String(Math.round(rate * 100)));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 max-w-xl space-y-2">
      <p className="text-sm text-stone">{t("commissionHelp")}</p>
      <Checkbox
        id="commission-on"
        checked={on}
        disabled={!canEdit}
        onChange={(e) => setOn(e.target.checked)}
        label={t("commissionEnabled")}
      />
      <label className="flex items-center gap-2" htmlFor="commission-rate">
        <span className="text-sm font-semibold">{t("rate")}</span>
        <Input
          id="commission-rate"
          type="number"
          min={0}
          max={50}
          value={r}
          disabled={!canEdit || !on}
          onChange={(e) => setR(e.target.value)}
          className="!mt-0 !w-24"
        />
        <span>%</span>
      </label>
      {canEdit ? (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const a = await saveSettingAction("coaching_commission_enabled", on);
              const b = await saveSettingAction(
                "coaching_commission_rate",
                Math.max(0, Math.min(50, Number(r))) / 100,
              );
              setMsg(a.ok && b.ok ? t("saved") : t("error"));
              router.refresh();
            })
          }
        >
          {t("save")}
        </Button>
      ) : (
        <p className="text-sm text-stone">{t("superAdminOnly")}</p>
      )}
      {msg ? (
        <p role="status" className="text-sm font-semibold">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
