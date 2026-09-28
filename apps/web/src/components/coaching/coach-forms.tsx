"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import {
  addFollowUpAction,
  addSlotsAction,
  closeSlotAction,
  completeBookingAction,
  saveOfferAction,
  updateCoachProfileAction,
} from "@/app/actions/coaching";

const LEVELS = ["discovery", "beginner", "intermediate", "advanced", "competition"] as const;

function useRun() {
  const router = useRouter();
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? ok : te.has(r.error!) ? te(r.error!) : te("server"));
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

type Offer = {
  id: string;
  title_fr: string;
  description_fr: string;
  language: string;
  modality: string;
  level: string;
  format: string;
  duration_min: number;
  price_xof: number;
  capacity: number;
  is_active: boolean;
};

export function OfferForm({ offer }: { offer: Offer | null }) {
  const t = useTranslations("coachSpace");
  const tc = useTranslations("coaching");
  const { pending, msg, run } = useRun();
  const [open, setOpen] = useState(false);
  if (!offer && !open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("newOffer")}
      </Button>
    );
  const id = offer?.id ?? "new";
  return (
    <details open={!offer} className="rounded-md border border-line p-3">
      <summary className="min-h-10 cursor-pointer font-semibold">
        {offer ? `${offer.title_fr} ${offer.is_active ? "" : `(${t("inactive")})`}` : t("newOffer")}
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () =>
              saveOfferAction({
                id: offer?.id,
                title_fr: f.get("title_fr"),
                description_fr: f.get("description_fr"),
                language: f.get("language"),
                modality: f.get("modality"),
                level: f.get("level"),
                format: f.get("format"),
                duration_min: f.get("duration_min"),
                price_xof: f.get("price_xof"),
                capacity: f.get("capacity"),
                is_active: f.get("is_active") === "on",
              }),
            t("saved"),
          );
        }}
      >
        <div className="sm:col-span-3">
          <Field id={`${id}-title`} label={t("offerTitle")}>
            <Input
              id={`${id}-title`}
              name="title_fr"
              defaultValue={offer?.title_fr}
              required
              minLength={3}
            />
          </Field>
        </div>
        <Field id={`${id}-lang`} label={tc("filters.language")}>
          <Select id={`${id}-lang`} name="language" defaultValue={offer?.language ?? "fr"}>
            {["fr", "en", "fon"].map((l) => (
              <option key={l} value={l}>
                {tc(`lang.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-mod`} label={tc("filters.modality")}>
          <Select id={`${id}-mod`} name="modality" defaultValue={offer?.modality ?? "in_person"}>
            {["in_person", "online"].map((l) => (
              <option key={l} value={l}>
                {tc(`modality.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-lvl`} label={tc("filters.level")}>
          <Select id={`${id}-lvl`} name="level" defaultValue={offer?.level ?? "beginner"}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {tc(`level.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-fmt`} label={tc("filters.format")}>
          <Select id={`${id}-fmt`} name="format" defaultValue={offer?.format ?? "individual"}>
            {["individual", "group"].map((l) => (
              <option key={l} value={l}>
                {tc(`format.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-dur`} label={t("durationMin")}>
          <Input
            id={`${id}-dur`}
            name="duration_min"
            type="number"
            min={15}
            defaultValue={offer?.duration_min ?? 60}
          />
        </Field>
        <Field id={`${id}-price`} label={t("price")}>
          <Input
            id={`${id}-price`}
            name="price_xof"
            type="number"
            min={0}
            step={500}
            defaultValue={offer?.price_xof ?? 10000}
          />
        </Field>
        <Field id={`${id}-cap`} label={t("capacity")}>
          <Input
            id={`${id}-cap`}
            name="capacity"
            type="number"
            min={1}
            defaultValue={offer?.capacity ?? 1}
          />
        </Field>
        <div className="sm:col-span-3">
          <Field id={`${id}-desc`} label={t("description")}>
            <textarea
              id={`${id}-desc`}
              name="description_fr"
              rows={3}
              defaultValue={offer?.description_fr}
              className="mt-1 w-full rounded-md border border-line bg-field p-3"
            />
          </Field>
        </div>
        <Checkbox
          id={`${id}-active`}
          name="is_active"
          defaultChecked={offer?.is_active ?? true}
          label={t("active")}
        />
        <div className="sm:col-span-3">
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
          {msg ? (
            <span role="status" className="ml-3 text-sm font-semibold">
              {msg}
            </span>
          ) : null}
        </div>
      </form>
    </details>
  );
}

export function SlotForm() {
  const t = useTranslations("coachSpace");
  const tc = useTranslations("coaching");
  const { pending, msg, run } = useRun();
  return (
    <form
      className="mt-4 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => addSlotsAction(Object.fromEntries(f)), t("slotsAdded"));
      }}
    >
      <Field id="slot-date" label={t("date")}>
        <Input id="slot-date" name="date" type="date" required />
      </Field>
      <Field id="slot-start" label={t("start")}>
        <Input id="slot-start" name="start" type="time" required defaultValue="16:00" />
      </Field>
      <Field id="slot-dur" label={t("durationMin")}>
        <Input id="slot-dur" name="duration_min" type="number" min={15} defaultValue={60} />
      </Field>
      <Field id="slot-mod" label={tc("filters.modality")}>
        <Select id="slot-mod" name="modality" defaultValue="in_person">
          <option value="in_person">{tc("modality.in_person")}</option>
          <option value="online">{tc("modality.online")}</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="slot-loc" label={t("location")}>
          <Input id="slot-loc" name="location" />
        </Field>
      </div>
      <Field id="slot-cap" label={t("capacity")}>
        <Input id="slot-cap" name="capacity" type="number" min={1} defaultValue={1} />
      </Field>
      <Field id="slot-rep" label={t("repeat")}>
        <Input id="slot-rep" name="repeat_weeks" type="number" min={1} max={12} defaultValue={1} />
      </Field>
      <div className="sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {t("addSlots")}
        </Button>
        {msg ? (
          <span role="status" className="ml-3 text-sm font-semibold">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function SlotClose({ id }: { id: string }) {
  const t = useTranslations("coachSpace");
  const { pending, run } = useRun();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("closeSlot")}
      className="grid size-8 place-items-center rounded-full hover:bg-surface"
      onClick={() => run(() => closeSlotAction(id), "")}
    >
      ×
    </button>
  );
}

export function BookingStatus({ id }: { id: string }) {
  const t = useTranslations("coachSpace");
  const { pending, run } = useRun();
  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold"
        onClick={() => run(() => completeBookingAction(id, "completed"), "")}
      >
        {t("markDone")}
      </button>
      <button
        type="button"
        disabled={pending}
        className="min-h-10 rounded-full border border-line px-3 text-sm"
        onClick={() => run(() => completeBookingAction(id, "no_show"), "")}
      >
        {t("noShow")}
      </button>
    </span>
  );
}

export function FollowUpForm({ students }: { students: { id: string; name: string }[] }) {
  const t = useTranslations("coachSpace");
  const { pending, msg, run } = useRun();
  const [kind, setKind] = useState<"note" | "homework">("note");
  return (
    <form
      className="mt-3 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_12rem]"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            addFollowUpAction({
              studentId: String(f.get("student")),
              kind,
              text: String(f.get("text") ?? ""),
              due: String(f.get("due") ?? ""),
              replayUrl: String(f.get("replay") ?? ""),
            }),
          t("sent"),
        );
        e.currentTarget.reset();
      }}
    >
      <Field id="fu-student" label={t("student")}>
        <Select id="fu-student" name="student">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="fu-kind" label={t("kind")}>
        <Select
          id="fu-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "note" | "homework")}
        >
          <option value="note">{t("progressNote")}</option>
          <option value="homework">{t("homework")}</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="fu-text" label={kind === "note" ? t("progressNote") : t("homework")}>
          <textarea
            id="fu-text"
            name="text"
            required
            rows={3}
            className="mt-1 w-full rounded-md border border-line bg-field p-3"
          />
        </Field>
      </div>
      {kind === "homework" ? (
        <Field id="fu-due" label={t("due")}>
          <Input id="fu-due" name="due" type="date" />
        </Field>
      ) : (
        <Field id="fu-replay" label={t("replay")}>
          <Input id="fu-replay" name="replay" type="url" placeholder="https://" />
        </Field>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
        {msg ? (
          <span role="status" className="ml-3 text-sm font-semibold">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function CoachProfileForm({
  c,
}: {
  c: {
    headline_fr: string;
    bio_fr: string;
    languages: string[];
    modalities: string[];
    levels: string[];
    city: string;
    specialties: string;
  };
}) {
  const t = useTranslations("coachSpace");
  const tc = useTranslations("coaching");
  const { pending, msg, run } = useRun();
  const [langs, setLangs] = useState(c.languages);
  const [mods, setMods] = useState(c.modalities);
  const [lvls, setLvls] = useState(c.levels);
  const toggle = (a: string[], v: string, set: (x: string[]) => void) =>
    set(a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            updateCoachProfileAction({
              headline_fr: f.get("headline_fr"),
              bio_fr: f.get("bio_fr"),
              city: f.get("city"),
              specialties: f.get("specialties"),
              languages: langs,
              modalities: mods,
              levels: lvls,
            }),
          t("saved"),
        );
      }}
    >
      <Field id="cp-headline" label={t("headline")}>
        <Input id="cp-headline" name="headline_fr" defaultValue={c.headline_fr} maxLength={160} />
      </Field>
      <Field id="cp-bio" label={t("bio")}>
        <textarea
          id="cp-bio"
          name="bio_fr"
          rows={5}
          defaultValue={c.bio_fr}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cp-city" label={t("city")}>
          <Input id="cp-city" name="city" defaultValue={c.city} />
        </Field>
        <Field id="cp-spec" label={t("specialties")}>
          <Input id="cp-spec" name="specialties" defaultValue={c.specialties} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6">
        {["fr", "en", "fon"].map((l) => (
          <Checkbox
            key={l}
            id={`cp-l-${l}`}
            checked={langs.includes(l)}
            onChange={() => toggle(langs, l, setLangs)}
            label={tc(`lang.${l}`)}
          />
        ))}
        {["in_person", "online"].map((m) => (
          <Checkbox
            key={m}
            id={`cp-m-${m}`}
            checked={mods.includes(m)}
            onChange={() => toggle(mods, m, setMods)}
            label={tc(`modality.${m}`)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6">
        {LEVELS.map((l) => (
          <Checkbox
            key={l}
            id={`cp-lv-${l}`}
            checked={lvls.includes(l)}
            onChange={() => toggle(lvls, l, setLvls)}
            label={tc(`level.${l}`)}
          />
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
      {msg ? (
        <span role="status" className="ml-3 text-sm font-semibold">
          {msg}
        </span>
      ) : null}
    </form>
  );
}
