"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { PuzzleBoard } from "@/components/chess/puzzle";
import { recordAttemptAction, suggestFonAction } from "@/app/actions/academy";
import type { Puzzle } from "@/lib/puzzles";

/** Puzzle relié au suivi des tentatives (première tentative du jour enregistrée). */
export function TrackedPuzzle({
  id,
  puzzle,
  context,
  signedIn,
}: {
  id: string;
  puzzle: Puzzle;
  context: "daily" | "challenge";
  signedIn: boolean;
}) {
  const [recorded, setRecorded] = useState(false);
  return (
    <PuzzleBoard
      puzzle={puzzle}
      onDone={(solved, moves) => {
        if (!signedIn || recorded) return;
        setRecorded(true);
        void recordAttemptAction(id, solved ? moves : null, context);
      }}
    />
  );
}

export function FonSuggestion({ termId }: { termId: string }) {
  const t = useTranslations("academy");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(suggestFonAction, null);
  if (state?.ok) return <span className="text-sm font-semibold">{t("suggestionThanks")}</span>;
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 text-sm font-semibold text-accent hover:underline"
      >
        {t("suggestFon")}
      </button>
    );
  return (
    <form action={action} className="mt-2 flex flex-wrap gap-2">
      <input type="hidden" name="termId" value={termId} />
      <label htmlFor={`fon-${termId}`} className="sr-only">
        {t("fonTerm")}
      </label>
      <input
        id={`fon-${termId}`}
        name="termFon"
        required
        maxLength={120}
        placeholder={t("fonTerm")}
        className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-field px-3 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-full bg-gold px-3 text-sm font-semibold text-onaccent"
      >
        {t("send")}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="w-full text-sm text-accent">
          {state.error === "auth_required" ? t("signInToSuggest") : t("suggestionError")}
        </span>
      ) : null}
    </form>
  );
}
