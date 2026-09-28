"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import {
  addPuzzleAction,
  decideFonAction,
  deleteContentAction,
  saveContentAction,
  togglePuzzleAction,
  type ContentType,
} from "@/app/actions/content";

export type FieldSpec =
  | { name: string; kind: "text" | "number" | "datetime" | "url"; label: string }
  | { name: string; kind: "i18n" | "i18nArea"; label: string }
  | { name: string; kind: "area" | "json"; label: string }
  | { name: string; kind: "select"; label: string; options: { value: string; label: string }[] }
  | { name: string; kind: "check"; label: string };

type Values = Record<string, unknown>;

/** Éditeur générique des contenus (champs décrits par le serveur, validation côté serveur). */
export function ContentEditor({
  type,
  id,
  fields,
  initial,
}: {
  type: ContentType;
  id: string | null;
  fields: FieldSpec[];
  initial: Values;
}) {
  const t = useTranslations("adminContent");
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, val: unknown) => setV({ ...v, [k]: val });
  const i18nVal = (k: string) => (v[k] as { fr: string; en: string }) ?? { fr: "", en: "" };
  const area = "mt-1 w-full rounded-md border border-line bg-white p-3";
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveContentAction(type, id, v);
          if (!r.ok) {
            setMsg(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.generic"));
            return;
          }
          setMsg(t("saved"));
          if (!id) router.replace(`/admin/contenus?onglet=${type}&id=${r.data!.id}`);
          else router.refresh();
        });
      }}
    >
      {fields.map((f) => {
        const id_ = `f-${f.name}`;
        if (f.kind === "i18n" || f.kind === "i18nArea")
          return (["fr", "en"] as const).map((l) => (
            <div key={`${f.name}-${l}`} className={f.kind === "i18nArea" ? "sm:col-span-2" : ""}>
              <label htmlFor={`${id_}-${l}`} className="block text-sm font-semibold">
                {f.label} ({l.toUpperCase()})
              </label>
              {f.kind === "i18n" ? (
                <Input
                  id={`${id_}-${l}`}
                  value={i18nVal(f.name)[l]}
                  onChange={(e) => set(f.name, { ...i18nVal(f.name), [l]: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <textarea
                  id={`${id_}-${l}`}
                  rows={8}
                  value={i18nVal(f.name)[l]}
                  onChange={(e) => set(f.name, { ...i18nVal(f.name), [l]: e.target.value })}
                  className={area}
                />
              )}
            </div>
          ));
        if (f.kind === "area" || f.kind === "json")
          return (
            <div key={f.name} className="sm:col-span-2">
              <label htmlFor={id_} className="block text-sm font-semibold">
                {f.label}
              </label>
              <textarea
                id={id_}
                rows={f.kind === "json" ? 6 : 8}
                value={String(v[f.name] ?? "")}
                onChange={(e) => set(f.name, e.target.value)}
                className={`${area} ${f.kind === "json" ? "font-mono text-sm" : ""}`}
              />
            </div>
          );
        if (f.kind === "select")
          return (
            <Field key={f.name} id={id_} label={f.label}>
              <Select
                id={id_}
                value={String(v[f.name] ?? "")}
                onChange={(e) => set(f.name, e.target.value)}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          );
        if (f.kind === "check")
          return (
            <div key={f.name} className="self-end">
              <Checkbox
                id={id_}
                checked={!!v[f.name]}
                onChange={(e) => set(f.name, e.target.checked)}
                label={f.label}
              />
            </div>
          );
        return (
          <Field key={f.name} id={id_} label={f.label}>
            <Input
              id={id_}
              type={
                f.kind === "number"
                  ? "number"
                  : f.kind === "datetime"
                    ? "datetime-local"
                    : f.kind === "url"
                      ? "url"
                      : "text"
              }
              value={String(v[f.name] ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
            />
          </Field>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {id ? (
          <button
            type="button"
            disabled={pending}
            className="min-h-11 px-3 font-semibold text-bordeaux"
            onClick={() => {
              if (!confirm(t("deleteConfirm"))) return;
              start(async () => {
                const r = await deleteContentAction(type, id);
                if (r.ok) router.replace(`/admin/contenus?onglet=${type}`);
                else setMsg(t("errors.generic"));
              });
            }}
          >
            {t("delete")}
          </button>
        ) : null}
        {msg ? (
          <span role="status" className="text-sm font-semibold">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function PuzzleAdd() {
  const t = useTranslations("adminContent");
  const [state, action, pending] = useActionState(addPuzzleAction, null);
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
      <Field id="pz-code" label={t("puzzle.code")}>
        <Input id="pz-code" name="code" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </Field>
      <Field id="pz-theme" label={t("puzzle.theme")}>
        <Input id="pz-theme" name="theme" required defaultValue="tactics" />
      </Field>
      <div className="sm:col-span-2">
        <Field id="pz-fen" label="FEN">
          <Input id="pz-fen" name="fen" required className="font-mono" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="pz-sol" label={t("puzzle.solution")} hint={t("puzzle.solutionHint")}>
          <Input id="pz-sol" name="solution" required className="font-mono" />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("puzzle.add")}
        </Button>
        {state ? (
          <span role="status" className="text-sm font-semibold">
            {state.ok
              ? t("saved")
              : t.has(`errors.${state.error}`)
                ? t(`errors.${state.error}`)
                : t("errors.generic")}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function RowButton({
  kind,
  id,
  value,
  label,
}: {
  kind: "puzzle" | "fonAccept" | "fonRefuse";
  id: string;
  value?: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold hover:bg-cream"
      onClick={() =>
        start(async () => {
          if (kind === "puzzle") await togglePuzzleAction(id, !value);
          else await decideFonAction(id, kind === "fonAccept");
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
