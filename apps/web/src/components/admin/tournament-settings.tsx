"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PAIRING_SYSTEMS } from "@chesspirit/shared";
import { useRouter } from "@/i18n/navigation";
import type { Tables } from "@/lib/supabase/types";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import { saveTournamentAction } from "@/app/actions/admin";

type T = Tables<"tournaments"> & { description_fr: string; description_en: string };

const TBC_FIELDS = [
  "schedule",
  "time_control",
  "rounds",
  "pairing_system",
  "fee",
  "prizes",
  "capacity",
  "rated",
] as const;
const STATUSES = [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
  "ongoing",
  "finished",
  "archived",
  "cancelled",
] as const;

function localParts(iso: string | undefined) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(new Date(iso).getTime() + 3600_000).toISOString(); // Porto-Novo = UTC+1, sans heure d'été
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

/** Réglages du tournoi : tout fait « À confirmer » se complète ici. */
export function TournamentSettings({
  tournament,
  prizesText,
  partnersText,
}: {
  tournament: T | null;
  prizesText: string;
  partnersText: string;
}) {
  const t = useTranslations("admin");
  const tt = useTranslations("tournament");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const tn = tournament;
  const { date, time } = localParts(tn?.starts_at);
  const scheduleTbc = tn?.unconfirmed_fields.includes("schedule") ?? true;
  const [tbc, setTbc] = useState<string[]>(tn?.unconfirmed_fields ?? [...TBC_FIELDS]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    const payload = {
      name: f.get("name"),
      slug: f.get("slug"),
      edition: f.get("edition") || undefined,
      venue: f.get("venue") || undefined,
      city: f.get("city") || undefined,
      starts_date: f.get("starts_date"),
      starts_time: f.get("starts_time") || "",
      status: f.get("status"),
      cadence: f.get("cadence") || "",
      base_minutes: num("base_minutes"),
      increment_seconds: num("increment_seconds"),
      rounds_count: num("rounds_count"),
      pairing_system: f.get("pairing_system"),
      entry_fee_xof: num("entry_fee_xof"),
      capacity: num("capacity"),
      is_online: f.get("is_online") === "on",
      rated: f.get("rated") === "on",
      allow_online_payment: f.get("allow_online_payment") === "on",
      allow_on_site_payment: f.get("allow_on_site_payment") === "on",
      description_fr: f.get("description_fr") ?? "",
      description_en: f.get("description_en") ?? "",
      prizes_text: f.get("prizes_text") ?? "",
      partners_text: f.get("partners_text") ?? "",
      unconfirmed_fields: tbc,
    };
    start(async () => {
      const r = await saveTournamentAction(tn?.id ?? null, payload);
      if (!r.ok) return setMsg(`${t("saveError")} (${r.error})`);
      setMsg(t("saved"));
      if (!tn) router.push(`/admin/tournois/${r.data!.id}?onglet=reglages`);
      else router.refresh();
    });
  }

  const tbcBox = (k: (typeof TBC_FIELDS)[number]) => (
    <Checkbox
      id={`tbc-${k}`}
      checked={tbc.includes(k)}
      onChange={(e) => setTbc(e.target.checked ? [...tbc, k] : tbc.filter((x) => x !== k))}
      label={<span className="text-sm">{t("markTbc")}</span>}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <section className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label={t("f.name")}>
          <Input id="name" name="name" defaultValue={tn?.name} required />
        </Field>
        <Field id="slug" label={t("f.slug")} hint={t("f.slugHint")}>
          <Input id="slug" name="slug" defaultValue={tn?.slug} pattern="[a-z0-9-]+" required />
        </Field>
        <Field id="edition" label={t("f.edition")} optional={t("optional")}>
          <Input id="edition" name="edition" defaultValue={tn?.edition ?? ""} />
        </Field>
        <Field id="status" label={t("f.status")}>
          <Select id="status" name="status" defaultValue={tn?.status ?? "draft"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tt(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="venue" label={t("f.venue")}>
          <Input id="venue" name="venue" defaultValue={tn?.venue ?? ""} />
        </Field>
        <Field id="city" label={t("f.city")}>
          <Input id="city" name="city" defaultValue={tn?.city ?? ""} />
        </Field>
        <Field id="starts_date" label={t("f.date")}>
          <Input id="starts_date" name="starts_date" type="date" defaultValue={date} required />
        </Field>
        <div>
          <Field id="starts_time" label={t("f.time")} hint={t("f.timeHint")}>
            <Input
              id="starts_time"
              name="starts_time"
              type="time"
              defaultValue={scheduleTbc ? "" : time}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field id="cadence" label={t("f.cadence")}>
          <Select id="cadence" name="cadence" defaultValue={tn?.cadence ?? ""}>
            <option value="">—</option>
            {(["blitz", "rapid", "classical"] as const).map((c) => (
              <option key={c} value={c}>
                {tt(`cadence.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="base_minutes" label={t("f.base")}>
            <Input
              id="base_minutes"
              name="base_minutes"
              type="number"
              min={1}
              defaultValue={tn?.base_minutes ?? ""}
            />
          </Field>
          <Field id="increment_seconds" label={t("f.increment")}>
            <Input
              id="increment_seconds"
              name="increment_seconds"
              type="number"
              min={0}
              defaultValue={tn?.increment_seconds ?? ""}
            />
          </Field>
          <div className="col-span-2">{tbcBox("time_control")}</div>
        </div>
        <div>
          <Field id="rounds_count" label={t("f.rounds")}>
            <Input
              id="rounds_count"
              name="rounds_count"
              type="number"
              min={1}
              defaultValue={tn?.rounds_count ?? ""}
            />
          </Field>
          {tbcBox("rounds")}
        </div>
        <div>
          <Field id="pairing_system" label={t("f.system")}>
            <Select
              id="pairing_system"
              name="pairing_system"
              defaultValue={tn?.pairing_system ?? "swiss_dutch"}
            >
              {PAIRING_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {tt(`system.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          {tbcBox("pairing_system")}
        </div>
        <div>
          <Field id="entry_fee_xof" label={t("f.fee")} hint={t("f.feeHint")}>
            <Input
              id="entry_fee_xof"
              name="entry_fee_xof"
              type="number"
              min={0}
              step={100}
              defaultValue={tn?.entry_fee_xof ?? ""}
            />
          </Field>
          {tbcBox("fee")}
        </div>
        <div>
          <Field id="capacity" label={t("f.capacity")}>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={tn?.capacity ?? ""}
            />
          </Field>
          {tbcBox("capacity")}
        </div>
        <div className="sm:col-span-2">
          <Checkbox
            id="rated"
            name="rated"
            defaultChecked={tn?.rated ?? false}
            label={t("f.rated")}
          />
          {tbcBox("rated")}
          <Checkbox
            id="is_online"
            name="is_online"
            defaultChecked={tn?.is_online ?? false}
            label={t("f.online")}
          />
          <Checkbox
            id="allow_online_payment"
            name="allow_online_payment"
            defaultChecked={tn?.allow_online_payment ?? true}
            label={t("f.onlinePayment")}
          />
          <Checkbox
            id="allow_on_site_payment"
            name="allow_on_site_payment"
            defaultChecked={tn?.allow_on_site_payment ?? true}
            label={t("f.onSitePayment")}
          />
          {tbcBox("schedule")}
        </div>
      </section>

      <section className="grid gap-5">
        <div>
          <label htmlFor="prizes_text" className="text-sm font-semibold">
            {t("f.prizes")}
          </label>
          <textarea
            id="prizes_text"
            name="prizes_text"
            rows={4}
            defaultValue={prizesText}
            className="mt-1 w-full rounded-md border border-line bg-white p-3"
            placeholder={t("f.prizesPlaceholder")}
          />
          {tbcBox("prizes")}
        </div>
        <div>
          <label htmlFor="partners_text" className="text-sm font-semibold">
            {t("f.partners")}
          </label>
          <textarea
            id="partners_text"
            name="partners_text"
            rows={3}
            defaultValue={partnersText}
            className="mt-1 w-full rounded-md border border-line bg-white p-3"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="description_fr" className="text-sm font-semibold">
              {t("f.descriptionFr")}
            </label>
            <textarea
              id="description_fr"
              name="description_fr"
              rows={6}
              defaultValue={tn?.description_fr ?? ""}
              className="mt-1 w-full rounded-md border border-line bg-white p-3"
            />
          </div>
          <div>
            <label htmlFor="description_en" className="text-sm font-semibold">
              {t("f.descriptionEn")}
            </label>
            <textarea
              id="description_en"
              name="description_en"
              rows={6}
              defaultValue={tn?.description_en ?? ""}
              className="mt-1 w-full rounded-md border border-line bg-white p-3"
            />
          </div>
        </div>
      </section>

      {msg ? (
        <p role="status" className="rounded bg-cream px-3 py-2 font-semibold">
          {msg}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
