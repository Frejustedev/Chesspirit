"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Field, Input } from "@/components/ui/form";
import {
  agreePostponementAction,
  decidePostponementAction,
  requestLicenseAction,
  requestPostponementAction,
} from "@/app/actions/leagues";

export function LicenseButton({
  seasonId,
  profileId,
  pending,
}: {
  seasonId: string;
  profileId: string;
  pending: boolean;
}) {
  const t = useTranslations("myLeagues");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <span>
      <Button
        className="min-h-10 px-4 text-sm"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await requestLicenseAction(seasonId, profileId);
            if (!r.ok) return setError(true);
            if (r.data?.redirect) window.location.assign(r.data.redirect);
            else router.refresh();
          })
        }
      >
        {pending ? t("payLicense") : t("getLicense")}
      </Button>
      {error ? (
        <span role="alert" className="ml-2 text-sm font-semibold text-accent">
          {t("error")}
        </span>
      ) : null}
    </span>
  );
}

export function PostponeForm({ pairingId, profileId }: { pairingId: string; profileId: string }) {
  const t = useTranslations("myLeagues");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 min-h-11 text-sm font-semibold text-accent hover:underline"
      >
        {t("askPostpone")}
      </button>
    );
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestPostponementAction({
            pairingId,
            profileId,
            reason,
            proposedDate: date,
          });
          if (r.ok) router.refresh();
          else setMsg(t("error"));
        });
      }}
    >
      <Field id={`reason-${pairingId}`} label={t("reason")}>
        <Input
          id={`reason-${pairingId}`}
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <Field id={`date-${pairingId}`} label={t("proposedDate")}>
        <Input
          id={`date-${pairingId}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {t("send")}
      </Button>
      {msg ? (
        <p role="alert" className="text-sm font-semibold text-accent">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

export function AgreeButton({ id }: { id: string }) {
  const t = useTranslations("myLeagues");
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      className="mt-2 min-h-10 px-4 text-sm"
      disabled={busy}
      onClick={() =>
        start(async () => {
          await agreePostponementAction(id);
          router.refresh();
        })
      }
    >
      {t("agree")}
    </Button>
  );
}

export function DecideButtons({ id, agreed }: { id: string; agreed: boolean }) {
  const t = useTranslations("myLeagues");
  const router = useRouter();
  const [busy, start] = useTransition();
  const go = (approve: boolean) =>
    start(async () => {
      await decidePostponementAction(id, approve);
      router.refresh();
    });
  return (
    <span className="flex gap-2">
      <Button className="min-h-10 px-3 text-sm" disabled={busy || !agreed} onClick={() => go(true)}>
        {t("approve")}
      </Button>
      <Button
        variant="secondary"
        className="min-h-10 px-3 text-sm"
        disabled={busy}
        onClick={() => go(false)}
      >
        {t("refuse")}
      </Button>
    </span>
  );
}
