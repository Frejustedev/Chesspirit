"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { expectedScore, kFactor, type Score } from "@chesspirit/shared";
import { Field, Input, Select } from "@/components/ui/form";

/** Vérifier un calcul : saisie d'une partie, affichage de chaque étape. */
export function RatingCalculator() {
  const t = useTranslations("method");
  const [ra, setRa] = useState(1500);
  const [rb, setRb] = useState(1600);
  const [games, setGames] = useState(40);
  const [age, setAge] = useState(25);
  const [peak, setPeak] = useState(1500);
  const [s, setS] = useState<Score>(1);
  const e = expectedScore(ra, rb);
  const k = kFactor({ gamesPlayed: games, age, rating: ra, peakRating: Math.max(peak, ra) });
  const delta = k * (s - e);
  return (
    <div className="rounded-lg border border-line p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="ra" label={t("ra")}>
          <Input id="ra" type="number" value={ra} onChange={(x) => setRa(Number(x.target.value))} />
        </Field>
        <Field id="rb" label={t("rb")}>
          <Input id="rb" type="number" value={rb} onChange={(x) => setRb(Number(x.target.value))} />
        </Field>
        <Field id="score" label={t("score")}>
          <Select
            id="score"
            value={String(s)}
            onChange={(x) => setS(Number(x.target.value) as Score)}
          >
            <option value="1">{t("win")}</option>
            <option value="0.5">{t("draw")}</option>
            <option value="0">{t("loss")}</option>
          </Select>
        </Field>
        <Field id="games" label={t("gamesPlayed")}>
          <Input
            id="games"
            type="number"
            value={games}
            onChange={(x) => setGames(Number(x.target.value))}
          />
        </Field>
        <Field id="age" label={t("age")}>
          <Input
            id="age"
            type="number"
            value={age}
            onChange={(x) => setAge(Number(x.target.value))}
          />
        </Field>
        <Field id="peak" label={t("peak")}>
          <Input
            id="peak"
            type="number"
            value={peak}
            onChange={(x) => setPeak(Number(x.target.value))}
          />
        </Field>
      </div>
      <dl
        className="tabular mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded bg-surface p-3">
          <dt className="text-sm text-stone">E</dt>
          <dd className="font-display text-2xl">{e.toFixed(3)}</dd>
        </div>
        <div className="rounded bg-surface p-3">
          <dt className="text-sm text-stone">K</dt>
          <dd className="font-display text-2xl">{k}</dd>
        </div>
        <div className="rounded bg-surface p-3">
          <dt className="text-sm text-stone">Δ</dt>
          <dd className={`font-display text-2xl ${delta >= 0 ? "text-success" : "text-danger"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
          </dd>
        </div>
        <div className="rounded bg-ink p-3 text-cream">
          <dt className="text-sm text-cream/70">{t("newRating")}</dt>
          <dd className="font-display text-2xl">{Math.round(ra + delta)}</dd>
        </div>
      </dl>
    </div>
  );
}
