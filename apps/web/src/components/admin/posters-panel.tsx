"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const FORMATS = ["a4", "a3", "post", "story", "status", "banner"] as const;

/** Affiches gratuites : aperçu et téléchargement PNG ou PDF, modèle Chesspirit ou neutre. */
export function PostersPanel({ slug, hasResults }: { slug: string; hasResults: boolean }) {
  const t = useTranslations("posters");
  const [template, setTemplate] = useState<"chesspirit" | "neutral">("chesspirit");
  const [kind, setKind] = useState<"announce" | "results">("announce");
  const url = (f: string, output?: string) =>
    `/api/tournaments/${slug}/poster?format=${f}&template=${template}&type=${kind}${output ? `&output=${output}` : ""}`;
  const chip = (active: boolean) =>
    `min-h-11 rounded-full border px-4 font-semibold ${active ? "border-bordeaux bg-bordeaux text-cream" : "border-line"}`;
  return (
    <div>
      <p className="max-w-2xl text-stone">{t("intro")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(template === "chesspirit")}
          onClick={() => setTemplate("chesspirit")}
        >
          {t("brand")}
        </button>
        <button
          type="button"
          className={chip(template === "neutral")}
          onClick={() => setTemplate("neutral")}
        >
          {t("neutral")}
        </button>
        <span className="mx-2 w-px bg-line" aria-hidden />
        <button
          type="button"
          className={chip(kind === "announce")}
          onClick={() => setKind("announce")}
        >
          {t("announce")}
        </button>
        <button
          type="button"
          className={chip(kind === "results")}
          onClick={() => setKind("results")}
          disabled={!hasResults}
        >
          {t("results")}
        </button>
      </div>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATS.map((f) => (
          <li key={f} className="rounded-lg border border-line p-3">
            <p className="font-semibold">{t(`format.${f}`)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu généré dynamiquement */}
            <img
              src={url(f)}
              alt={t("preview", { format: t(`format.${f}`) })}
              loading="lazy"
              className="mt-2 max-h-72 w-full rounded bg-surface object-contain"
            />
            <div className="mt-2 flex gap-3 text-sm font-semibold">
              <a href={url(f)} download className="text-accent hover:underline">
                PNG
              </a>
              <a href={url(f, "pdf")} className="text-accent hover:underline">
                PDF
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
