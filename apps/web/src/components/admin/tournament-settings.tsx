"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PAIRING_SYSTEMS, type CustomField } from "@chesspirit/shared";
import { useRouter } from "@/i18n/navigation";
import type { Tables } from "@/lib/supabase/types";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import { saveTournamentAction } from "@/app/actions/admin";

type T = Tables<"tournaments"> & { description_fr: string; description_en: string };

type TbcField =
  | "schedule"
  | "time_control"
  | "rounds"
  | "pairing_system"
  | "fee"
  | "prizes"
  | "capacity"
  | "rated";
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
const TIEBREAKS = [
  "buchholz_cut1",
  "buchholz",
  "sonneborn_berger",
  "direct_encounter",
  "wins",
  "performance",
] as const;
const STEPS = ["infos", "format", "prizes", "access", "form"] as const;
type Step = (typeof STEPS)[number];

function localParts(iso: string | null | undefined) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(new Date(iso).getTime() + 3600_000).toISOString(); // Porto-Novo = UTC+1, sans heure d'été
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

/**
 * Création (assistant en 5 étapes) et réglages d'un tournoi.
 * Tout fait « À confirmer » se complète ici ; les étapes restent toutes visibles en modification.
 */
export function TournamentSettings({
  tournament,
  prizesText,
  partnersText,
  formFields = [],
}: {
  tournament: T | null;
  prizesText: string;
  partnersText: string;
  formFields?: CustomField[];
}) {
  const t = useTranslations("admin");
  const tw = useTranslations("wizard");
  const tt = useTranslations("tournament");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const tn = tournament;
  const wizard = !tn;
  const [step, setStep] = useState<Step>("infos");
  const { date, time } = localParts(tn?.starts_at);
  const { date: endDate } = localParts(tn?.ends_at);
  const scheduleTbc = tn?.unconfirmed_fields.includes("schedule") ?? true;
  const [tbc, setTbc] = useState<string[]>(tn?.unconfirmed_fields ?? []);
  const [tiebreaks, setTiebreaks] = useState<string[]>(
    tn?.tiebreaks ?? ["buchholz_cut1", "buchholz", "sonneborn_berger"],
  );
  const [fields, setFields] = useState<CustomField[]>(formFields);
  const [savedKeys] = useState(() => new Set(formFields.map((f) => f.key)));
  const cond = (tn?.conditions ?? {}) as Record<string, string | number>;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (wizard && step !== "form") {
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      setStep(STEPS[STEPS.indexOf(step) + 1]!);
      return;
    }
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
      ends_date: f.get("ends_date") || "",
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
      counts_for_tour: f.get("counts_for_tour") === "on",
      allow_online_payment: f.get("allow_online_payment") === "on",
      allow_on_site_payment: f.get("allow_on_site_payment") === "on",
      waitlist_enabled: f.get("waitlist_enabled") === "on",
      validation_mode: f.get("validation_mode"),
      bye_points: Number(f.get("bye_points") ?? 1),
      initial_color: f.get("initial_color"),
      description_fr: f.get("description_fr") ?? "",
      description_en: f.get("description_en") ?? "",
      prizes_text: f.get("prizes_text") ?? "",
      partners_text: f.get("partners_text") ?? "",
      unconfirmed_fields: tbc,
      tiebreaks,
      conditions: {
        min_rating: num("min_rating"),
        max_rating: num("max_rating"),
        min_age: num("min_age"),
        max_age: num("max_age"),
        sex: f.get("cond_sex") || undefined,
      },
      form_fields: fields.filter((x) => x.key && x.label.fr),
    };
    start(async () => {
      const r = await saveTournamentAction(tn?.id ?? null, payload);
      if (!r.ok) return setMsg(`${t("saveError")} (${r.error})`);
      setMsg(t("saved"));
      if (!tn) router.push(`/admin/tournois/${r.data!.id}?onglet=reglages`);
      else router.refresh();
    });
  }

  const tbcBox = (k: TbcField) => (
    <Checkbox
      id={`tbc-${k}`}
      checked={tbc.includes(k)}
      onChange={(e) => setTbc(e.target.checked ? [...tbc, k] : tbc.filter((x) => x !== k))}
      label={<span className="text-sm">{t("markTbc")}</span>}
    />
  );
  // En mode assistant, les étapes masquées restent dans le formulaire (valeurs conservées).
  const section = (s: Step) => (wizard && step !== s ? "hidden" : "grid gap-5 sm:grid-cols-2");
  const heading = (s: Step) => (
    <h2 className="font-display text-2xl font-semibold sm:col-span-2">
      {wizard ? <span className="mr-2 text-gold-deep">{STEPS.indexOf(s) + 1}.</span> : null}
      {tw(`step.${s}`)}
    </h2>
  );
  const move = (i: number, d: number) => {
    const next = [...tiebreaks];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTiebreaks(next);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate={!wizard}>
      {wizard ? (
        <ol className="flex flex-wrap gap-2" aria-label={tw("progress")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(s)}
                aria-current={step === s ? "step" : undefined}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${step === s ? "border-bordeaux bg-bordeaux text-cream" : "border-line"}`}
              >
                {i + 1}. {tw(`step.${s}`)}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <section className={section("infos")}>
        {heading("infos")}
        <Field id="name" label={t("f.name")}>
          <Input id="name" name="name" defaultValue={tn?.name} required minLength={3} />
        </Field>
        <Field id="slug" label={t("f.slug")} hint={t("f.slugHint")}>
          <Input
            id="slug"
            name="slug"
            defaultValue={tn?.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
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
        <Field id="starts_time" label={t("f.time")} hint={t("f.timeHint")}>
          <Input
            id="starts_time"
            name="starts_time"
            type="time"
            defaultValue={scheduleTbc ? "" : time}
          />
        </Field>
        <Field id="ends_date" label={tw("endDate")} optional={t("optional")}>
          <Input id="ends_date" name="ends_date" type="date" defaultValue={endDate} />
        </Field>
        <div className="sm:col-span-2">
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
        <div>
          <label htmlFor="description_fr" className="text-sm font-semibold">
            {t("f.descriptionFr")}
          </label>
          <textarea
            id="description_fr"
            name="description_fr"
            rows={5}
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
            rows={5}
            defaultValue={tn?.description_en ?? ""}
            className="mt-1 w-full rounded-md border border-line bg-white p-3"
          />
        </div>
      </section>

      <section className={section("format")}>
        {heading("format")}
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
        <Field id="bye_points" label={tw("byePoints")}>
          <Select id="bye_points" name="bye_points" defaultValue={String(tn?.bye_points ?? 1)}>
            <option value="1">1</option>
            <option value="0.5">½</option>
            <option value="0">0</option>
          </Select>
        </Field>
        <Field id="initial_color" label={tw("initialColor")}>
          <Select
            id="initial_color"
            name="initial_color"
            defaultValue={tn?.initial_color ?? "white1"}
          >
            <option value="white1">{tw("white1")}</option>
            <option value="black1">{tw("black1")}</option>
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold">{tw("tiebreaks")}</legend>
          <p className="text-sm text-stone">{tw("tiebreaksHelp")}</p>
          <ol className="mt-2 space-y-1">
            {tiebreaks.map((k, i) => (
              <li key={k} className="flex items-center gap-2 rounded border border-line px-3 py-1">
                <span className="tabular w-5 text-stone">{i + 1}</span>
                <span className="flex-1">{tw(`tb.${k}`)}</span>
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded hover:bg-cream"
                  aria-label={tw("up")}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded hover:bg-cream"
                  aria-label={tw("down")}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded hover:bg-cream"
                  aria-label={tw("remove")}
                  onClick={() => setTiebreaks(tiebreaks.filter((x) => x !== k))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIEBREAKS.filter((k) => !tiebreaks.includes(k)).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTiebreaks([...tiebreaks, k])}
                className="min-h-10 rounded-full border border-dashed border-line px-3 text-sm"
              >
                + {tw(`tb.${k}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={section("prizes")}>
        {heading("prizes")}
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
          <label htmlFor="prizes_text" className="text-sm font-semibold">
            {t("f.prizes")}
          </label>
          <textarea
            id="prizes_text"
            name="prizes_text"
            rows={5}
            defaultValue={prizesText}
            className="mt-1 w-full rounded-md border border-line bg-white p-3"
            placeholder={t("f.prizesPlaceholder")}
          />
          <p className="text-sm text-stone">{tw("specialPrizes")}</p>
          {tbcBox("prizes")}
        </div>
      </section>

      <section className={section("access")}>
        {heading("access")}
        <Field id="min_rating" label={tw("minRating")} optional={t("optional")}>
          <Input
            id="min_rating"
            name="min_rating"
            type="number"
            defaultValue={cond.min_rating ?? ""}
          />
        </Field>
        <Field id="max_rating" label={tw("maxRating")} optional={t("optional")}>
          <Input
            id="max_rating"
            name="max_rating"
            type="number"
            defaultValue={cond.max_rating ?? ""}
          />
        </Field>
        <Field id="min_age" label={tw("minAge")} optional={t("optional")}>
          <Input id="min_age" name="min_age" type="number" defaultValue={cond.min_age ?? ""} />
        </Field>
        <Field id="max_age" label={tw("maxAge")} optional={t("optional")}>
          <Input id="max_age" name="max_age" type="number" defaultValue={cond.max_age ?? ""} />
        </Field>
        <Field id="cond_sex" label={tw("sex")}>
          <Select id="cond_sex" name="cond_sex" defaultValue={String(cond.sex ?? "")}>
            <option value="">{tw("sexAll")}</option>
            <option value="F">{tw("sexF")}</option>
            <option value="M">{tw("sexM")}</option>
          </Select>
        </Field>
        <Field id="validation_mode" label={tw("validation")}>
          <Select
            id="validation_mode"
            name="validation_mode"
            defaultValue={tn?.validation_mode ?? "auto"}
          >
            <option value="auto">{tw("auto")}</option>
            <option value="manual">{tw("manual")}</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            id="rated"
            name="rated"
            defaultChecked={tn?.rated ?? false}
            label={t("f.rated")}
          />
          {tbcBox("rated")}
          <Checkbox
            id="counts_for_tour"
            name="counts_for_tour"
            defaultChecked={tn?.counts_for_tour ?? false}
            label={tw("countsForTour")}
          />
          <Checkbox
            id="is_online"
            name="is_online"
            defaultChecked={tn?.is_online ?? false}
            label={t("f.online")}
          />
          <Checkbox
            id="waitlist_enabled"
            name="waitlist_enabled"
            defaultChecked={tn?.waitlist_enabled ?? true}
            label={tw("waitlist")}
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

      <section className={section("form")}>
        {heading("form")}
        <p className="text-sm text-stone sm:col-span-2">{tw("formHelp")}</p>
        <ul className="space-y-3 sm:col-span-2">
          {fields.map((fd, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
            >
              <Input
                aria-label={tw("fieldLabel")}
                placeholder={tw("fieldLabel")}
                value={fd.label.fr}
                onChange={(e) => {
                  const label = e.target.value;
                  // Les champs déjà enregistrés gardent leur clé (réponses existantes) ; les nouveaux la dérivent du libellé.
                  const key = savedKeys.has(fd.key)
                    ? fd.key
                    : label
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "")
                        .slice(0, 40) || `champ_${i + 1}`;
                  setFields(
                    fields.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            key: /^[a-z]/.test(key) ? key : `c_${key}`,
                            label: { fr: label, en: x.label.en || label },
                          }
                        : x,
                    ),
                  );
                }}
                className="!mt-0"
              />
              <Input
                aria-label={tw("fieldOptions")}
                placeholder={tw("fieldOptions")}
                value={(fd.options ?? []).join(", ")}
                disabled={fd.type !== "select"}
                onChange={(e) =>
                  setFields(
                    fields.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            options: e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          }
                        : x,
                    ),
                  )
                }
                className="!mt-0"
              />
              <Select
                aria-label={tw("fieldType")}
                value={fd.type}
                onChange={(e) =>
                  setFields(
                    fields.map((x, j) =>
                      j === i ? { ...x, type: e.target.value as CustomField["type"] } : x,
                    ),
                  )
                }
                className="!mt-0"
              >
                {(["text", "select", "checkbox", "number"] as const).map((ty) => (
                  <option key={ty} value={ty}>
                    {tw(`type.${ty}`)}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`req-${i}`}
                  checked={fd.required}
                  onChange={(e) =>
                    setFields(
                      fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                    )
                  }
                  label={<span className="text-sm">{tw("required")}</span>}
                />
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded hover:bg-cream"
                  aria-label={tw("remove")}
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setFields([
                ...fields,
                { key: "", label: { fr: "", en: "" }, type: "text", required: false },
              ])
            }
          >
            {tw("addField")}
          </Button>
        </div>
      </section>

      {msg ? (
        <p role="status" className="rounded bg-cream px-3 py-2 font-semibold">
          {msg}
        </p>
      ) : null}
      <div className="flex gap-3">
        {wizard && step !== "infos" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1]!)}
          >
            {tw("previous")}
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending
            ? t("saving")
            : wizard && step !== "form"
              ? tw("next")
              : wizard
                ? tw("create")
                : t("save")}
        </Button>
      </div>
    </form>
  );
}
