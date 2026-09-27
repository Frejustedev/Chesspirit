"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox, Field, Input } from "@/components/ui/form";
import { applyCoachAction } from "@/app/actions/coaching";

export function ApplicationForm({ city }: { city: string }) {
  const t = useTranslations("becomeCoach");
  const tc = useTranslations("coaching");
  const [langs, setLangs] = useState<string[]>(["fr"]);
  const [mods, setMods] = useState<string[]>(["in_person"]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  if (done)
    return (
      <p role="status" className="rounded-lg bg-gold-soft/60 p-5 font-serif text-lg">
        {t("thanks")}
      </p>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await applyCoachAction({
            experience: f.get("experience"),
            city: f.get("city"),
            credentials_note: f.get("credentials_note"),
            languages: langs,
            modalities: mods,
          });
          if (r.ok) setDone(true);
          else setError(t("error"));
        });
      }}
    >
      <Field id="experience" label={t("experience")} hint={t("experienceHint")}>
        <textarea
          id="experience"
          name="experience"
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          className="mt-1 w-full rounded-md border border-line bg-white p-3"
        />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold">{t("languages")}</legend>
        <div className="flex flex-wrap gap-4">
          {["fr", "en", "fon"].map((l) => (
            <Checkbox
              key={l}
              id={`l-${l}`}
              checked={langs.includes(l)}
              onChange={() => toggle(langs, l, setLangs)}
              label={tc(`lang.${l}`)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t("modalities")}</legend>
        <div className="flex flex-wrap gap-4">
          {["in_person", "online"].map((m) => (
            <Checkbox
              key={m}
              id={`m-${m}`}
              checked={mods.includes(m)}
              onChange={() => toggle(mods, m, setMods)}
              label={tc(`modality.${m}`)}
            />
          ))}
        </div>
      </fieldset>
      <Field id="city" label={t("city")}>
        <Input id="city" name="city" defaultValue={city} />
      </Field>
      <Field id="credentials_note" label={t("credentials")} optional={t("optional")}>
        <Input id="credentials_note" name="credentials_note" />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}
