"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PuzzleBoard } from "@/components/chess/puzzle";
import { Button } from "@/components/ui/form";
import type { Puzzle } from "@/lib/puzzles";
import { placementAction } from "@/app/actions/coaching";

export function PlacementTest({ puzzles }: { puzzles: Puzzle[] }) {
  const t = useTranslations("placement");
  const tc = useTranslations("coaching");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [current, setCurrent] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const next = () => {
    const a = [...answers, current ?? false];
    setAnswers(a);
    setCurrent(null);
    if (i + 1 < puzzles.length) setI(i + 1);
    else
      start(async () => {
        const r = await placementAction(a.filter(Boolean).length, a.length, a);
        if (r.ok) setLevel(r.data!.level);
      });
  };

  if (level) {
    return (
      <div className="rounded-lg bg-ink p-6 text-cream" role="status">
        <p className="text-sm uppercase tracking-[0.16em] text-gold">{t("result")}</p>
        <p className="mt-2 font-display text-4xl font-semibold">{tc(`level.${level}`)}</p>
        <p className="mt-2 text-cream/80">
          {t("score", { score: answers.filter(Boolean).length, total: answers.length })}
        </p>
        <Link
          href={`/coaching?niveau=${level}`}
          className="mt-5 inline-flex min-h-12 items-center rounded-full bg-gold px-5 font-semibold text-onaccent hover:bg-accent"
        >
          {t("seeOffers")}
        </Link>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold">{t("progress", { i: i + 1, n: puzzles.length })}</span>
        <span className="flex gap-1" aria-hidden>
          {puzzles.map((_, k) => (
            <span
              key={k}
              className={`size-2.5 rounded-full ${k < answers.length ? (answers[k] ? "bg-success" : "bg-danger") : k === i ? "bg-gold" : "bg-line"}`}
            />
          ))}
        </span>
      </div>
      <PuzzleBoard
        key={puzzles[i]!.id}
        puzzle={puzzles[i]!}
        onDone={(ok) => setCurrent((c) => (c === null ? ok : c))}
      />
      <div className="mt-4 flex gap-3">
        <Button onClick={next} disabled={pending || current === null}>
          {i + 1 < puzzles.length ? t("next") : t("finish")}
        </Button>
        {current === null ? (
          <Button variant="ghost" onClick={() => setCurrent(false)}>
            {t("skip")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
