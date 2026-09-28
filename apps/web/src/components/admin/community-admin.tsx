"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import {
  addCategoryAction,
  addNomineeAction,
  createEditionAction,
  createPvmAction,
  decideAmbassadorAction,
  deleteAwardItemAction,
  savePlanAction,
  setEditionStatusAction,
} from "@/app/actions/admin-community";

function useRun() {
  const t = useTranslations("adminCommunity");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok)
        return setMsg({
          text: t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.generic"),
          error: true,
        });
      setMsg({ text: t("saved"), error: false });
      after?.();
      router.refresh();
    });
  const status = msg ? (
    <span
      role={msg.error ? "alert" : "status"}
      className={`text-sm font-semibold ${msg.error ? "text-accent" : "text-success"}`}
    >
      {msg.text}
    </span>
  ) : null;
  return { busy, run, status };
}

export function PlanForm({
  code,
  price,
  duration,
  active,
}: {
  code: "free" | "premium";
  price: number | null;
  duration: number | null;
  active: boolean;
}) {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  const [p, setP] = useState(price === null ? "" : String(price));
  const [d, setD] = useState(duration === null ? "" : String(duration));
  const [a, setA] = useState(active);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          savePlanAction({
            code,
            price: p === "" ? null : Number(p),
            duration: d === "" ? null : Number(d),
            active: a,
          }),
        );
      }}
    >
      <Field
        id={`plan-${code}-price`}
        label={t("price")}
        hint={code === "premium" ? t("priceHint") : undefined}
      >
        <Input
          id={`plan-${code}-price`}
          type="number"
          min={0}
          value={p}
          disabled={code === "free"}
          onChange={(e) => setP(e.target.value)}
        />
      </Field>
      <Field id={`plan-${code}-duration`} label={t("duration")}>
        <Input
          id={`plan-${code}-duration`}
          type="number"
          min={1}
          max={36}
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </Field>
      <Checkbox
        id={`plan-${code}-active`}
        checked={a}
        onChange={(e) => setA(e.target.checked)}
        label={t("activePlan")}
      />
      <Button type="submit" disabled={busy}>
        {t("save")}
      </Button>
      {status}
    </form>
  );
}

export function AmbassadorDecision({ profileId }: { profileId: string }) {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        className="min-h-10 px-4 text-sm"
        disabled={busy}
        onClick={() => run(() => decideAmbassadorAction(profileId, true))}
      >
        {t("approve")}
      </Button>
      <button
        type="button"
        disabled={busy}
        className="min-h-10 px-3 text-sm font-semibold text-accent"
        onClick={() => run(() => decideAmbassadorAction(profileId, false))}
      >
        {t("refuse")}
      </button>
      {status}
    </span>
  );
}

export function EditionForm() {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  const [v, setV] = useState({
    year: String(new Date().getFullYear()),
    slug: "",
    fr: "",
    en: "",
    ends: "",
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          createEditionAction({
            year: Number(v.year),
            slug: v.slug,
            title: { fr: v.fr, en: v.en },
            votingEndsAt: v.ends || null,
          }),
        );
      }}
    >
      <Field id="ed-year" label={t("year")}>
        <Input
          id="ed-year"
          type="number"
          value={v.year}
          onChange={(e) => setV({ ...v, year: e.target.value })}
          required
        />
      </Field>
      <Field id="ed-slug" label={t("slug")}>
        <Input
          id="ed-slug"
          value={v.slug}
          onChange={(e) => setV({ ...v, slug: e.target.value })}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
        />
      </Field>
      <Field id="ed-fr" label={t("titleFr")}>
        <Input
          id="ed-fr"
          value={v.fr}
          onChange={(e) => setV({ ...v, fr: e.target.value })}
          required
        />
      </Field>
      <Field id="ed-en" label={t("titleEn")}>
        <Input id="ed-en" value={v.en} onChange={(e) => setV({ ...v, en: e.target.value })} />
      </Field>
      <Field id="ed-ends" label={t("votingEnds")}>
        <Input
          id="ed-ends"
          type="datetime-local"
          value={v.ends}
          onChange={(e) => setV({ ...v, ends: e.target.value })}
        />
      </Field>
      <div className="flex items-end gap-3">
        <Button type="submit" disabled={busy}>
          {t("createEdition")}
        </Button>
        {status}
      </div>
    </form>
  );
}

export function EditionStatus({ id, status: current }: { id: string; status: string }) {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <label htmlFor={`ed-status-${id}`} className="sr-only">
        {t("status")}
      </label>
      <Select
        id={`ed-status-${id}`}
        defaultValue={current}
        disabled={busy}
        onChange={(e) =>
          run(() => setEditionStatusAction(id, e.target.value as "draft" | "voting" | "closed"))
        }
      >
        {(["draft", "voting", "closed"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`editionStatus.${s}`)}
          </option>
        ))}
      </Select>
      {status}
    </span>
  );
}

export function CategoryAdd({ editionId }: { editionId: string }) {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addCategoryAction(editionId, { fr, en }),
          () => {
            setFr("");
            setEn("");
          },
        );
      }}
    >
      <Field id={`cat-fr-${editionId}`} label={t("categoryFr")}>
        <Input
          id={`cat-fr-${editionId}`}
          value={fr}
          onChange={(e) => setFr(e.target.value)}
          required
        />
      </Field>
      <Field id={`cat-en-${editionId}`} label={t("categoryEn")}>
        <Input id={`cat-en-${editionId}`} value={en} onChange={(e) => setEn(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy}>
        {t("addCategory")}
      </Button>
      {status}
    </form>
  );
}

export function NomineeAdd({ categoryId }: { categoryId: string }) {
  const t = useTranslations("adminCommunity");
  const { busy, run, status } = useRun();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addNomineeAction({ categoryId, name, description }),
          () => {
            setName("");
            setDescription("");
          },
        );
      }}
    >
      <Field id={`nom-${categoryId}`} label={t("nominee")}>
        <Input
          id={`nom-${categoryId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </Field>
      <Field id={`nom-d-${categoryId}`} label={t("nomineeDescription")}>
        <Input
          id={`nom-d-${categoryId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {t("addNominee")}
      </Button>
      {status}
    </form>
  );
}

export function DeleteAwardItem({
  kind,
  id,
  label,
}: {
  kind: "category" | "nominee";
  id: string;
  label: string;
}) {
  const t = useTranslations("adminCommunity");
  const { busy, run } = useRun();
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`${t("delete")} : ${label}`}
      className="min-h-10 px-2 text-sm font-semibold text-accent"
      onClick={() => {
        if (confirm(t("deleteConfirm"))) run(() => deleteAwardItemAction(kind, id));
      }}
    >
      {t("delete")}
    </button>
  );
}

export function PvmCreate() {
  const t = useTranslations("adminCommunity");
  const router = useRouter();
  const { busy, run, status } = useRun();
  const [v, setV] = useState({ slug: "", fr: "", en: "", master: "", color: "w", minutes: "1440" });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createPvmAction({
              slug: v.slug,
              title: { fr: v.fr, en: v.en },
              masterName: v.master,
              publicColor: v.color,
              voteMinutes: Number(v.minutes),
            }),
          () => router.push(`/communaute/public-contre-le-maitre/${v.slug}`),
        );
      }}
    >
      <Field id="pvm-slug" label={t("slug")}>
        <Input
          id="pvm-slug"
          value={v.slug}
          onChange={(e) => setV({ ...v, slug: e.target.value })}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
        />
      </Field>
      <Field id="pvm-master" label={t("masterName")}>
        <Input
          id="pvm-master"
          value={v.master}
          onChange={(e) => setV({ ...v, master: e.target.value })}
          required
          minLength={2}
        />
      </Field>
      <Field id="pvm-fr" label={t("titleFr")}>
        <Input
          id="pvm-fr"
          value={v.fr}
          onChange={(e) => setV({ ...v, fr: e.target.value })}
          required
        />
      </Field>
      <Field id="pvm-en" label={t("titleEn")}>
        <Input id="pvm-en" value={v.en} onChange={(e) => setV({ ...v, en: e.target.value })} />
      </Field>
      <Field id="pvm-color" label={t("publicColor")}>
        <Select
          id="pvm-color"
          value={v.color}
          onChange={(e) => setV({ ...v, color: e.target.value })}
        >
          <option value="w">{t("white")}</option>
          <option value="b">{t("black")}</option>
        </Select>
      </Field>
      <Field id="pvm-minutes" label={t("voteMinutes")}>
        <Input
          id="pvm-minutes"
          type="number"
          min={5}
          max={10080}
          value={v.minutes}
          onChange={(e) => setV({ ...v, minutes: e.target.value })}
          required
        />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {t("createPvm")}
        </Button>
        {status}
      </div>
    </form>
  );
}
