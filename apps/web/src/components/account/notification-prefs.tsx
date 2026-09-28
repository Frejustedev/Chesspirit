"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox } from "@/components/ui/form";
import { saveNotificationPrefsAction } from "@/app/actions/notifications";

export function NotificationPrefs({
  initial,
  whatsappAvailable,
}: {
  initial: { email: boolean; sms: boolean; whatsapp: boolean };
  whatsappAvailable: boolean;
}) {
  const t = useTranslations("notificationsPage");
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2 rounded-lg border border-line p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveNotificationPrefsAction(v);
          setMsg(r.ok ? t("saved") : t("error"));
        });
      }}
    >
      <Checkbox
        id="n-email"
        checked={v.email}
        onChange={(e) => setV({ ...v, email: e.target.checked })}
        label={t("email")}
      />
      <Checkbox
        id="n-sms"
        checked={v.sms}
        onChange={(e) => setV({ ...v, sms: e.target.checked })}
        label={t("sms")}
      />
      <Checkbox
        id="n-wa"
        checked={v.whatsapp}
        onChange={(e) => setV({ ...v, whatsapp: e.target.checked })}
        label={t("whatsapp")}
      />
      {!whatsappAvailable ? <p className="text-sm text-stone">{t("whatsappSoon")}</p> : null}
      <p className="text-sm text-stone">{t("help")}</p>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {msg ? (
          <span role="status" className="text-sm font-semibold">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}
