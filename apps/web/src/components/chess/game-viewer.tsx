"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Move } from "chess.js";
import { useTranslations } from "next-intl";
import { Board } from "./board";
import { EnginePanel } from "./engine-panel";
import { IconFirst, IconPrev, IconNext, IconLast, IconFlip } from "@/components/icons";

/** Lecteur PGN : échiquier, liste des coups, navigation au clavier. */
export function GameViewer({
  pgn,
  analysis,
  onPlyChange,
}: {
  pgn: string;
  analysis?: React.ReactNode;
  onPlyChange?: (ply: number, san: string | null) => void;
}) {
  const t = useTranslations("viewer");
  const { moves, fens, error } = useMemo(() => {
    const c = new Chess();
    try {
      c.loadPgn(pgn);
    } catch {
      return { moves: [] as Move[], fens: [new Chess().fen()], error: true };
    }
    const history = c.history({ verbose: true });
    const start = history[0]?.before ?? c.fen();
    return { moves: history, fens: [start, ...history.map((m) => m.after)], error: false };
  }, [pgn]);
  const [ply, setPly] = useState(fens.length - 1);
  const [orientation, setOrientation] = useState<"w" | "b">("w");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(fens.length - 1, p + 1));
      if (e.key === "Home") setPly(0);
      if (e.key === "End") setPly(fens.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fens.length]);

  const last = ply > 0 ? moves[ply - 1] : null;
  useEffect(() => {
    onPlyChange?.(ply, last?.san ?? null);
  }, [ply, last, onPlyChange]);
  const fen = fens[ply]!;
  const check = useMemo(() => {
    const c = new Chess(fen);
    if (!c.inCheck()) return null;
    for (const row of c.board())
      for (const p of row) if (p?.type === "k" && p.color === c.turn()) return p.square;
    return null;
  }, [fen]);

  if (error) return <p className="rounded bg-bordeaux-soft p-4 text-rose">{t("invalid")}</p>;
  const btn =
    "grid size-11 place-items-center rounded-full border border-line hover:bg-surface disabled:opacity-40";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,34rem)_1fr]">
      <div>
        <Board
          fen={fen}
          orientation={orientation}
          lastMove={last ? [last.from, last.to] : null}
          checkSquare={check}
          label={t("board")}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => setPly(0)}
              disabled={ply === 0}
              aria-label={t("first")}
            >
              <IconFirst className="size-5" />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => setPly(ply - 1)}
              disabled={ply === 0}
              aria-label={t("prev")}
            >
              <IconPrev className="size-5" />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => setPly(ply + 1)}
              disabled={ply === fens.length - 1}
              aria-label={t("next")}
            >
              <IconNext className="size-5" />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => setPly(fens.length - 1)}
              disabled={ply === fens.length - 1}
              aria-label={t("last")}
            >
              <IconLast className="size-5" />
            </button>
          </div>
          <button
            type="button"
            className={btn}
            onClick={() => setOrientation(orientation === "w" ? "b" : "w")}
            aria-label={t("flip")}
          >
            <IconFlip className="size-5" />
          </button>
        </div>
      </div>
      <div className="min-w-0">
        <ol
          className="grid max-h-[28rem] grid-cols-[2.5rem_1fr_1fr] overflow-y-auto rounded-[var(--radius-card)] border border-line text-[0.95rem]"
          aria-label={t("moves")}
        >
          {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
            <li key={i} className="contents">
              <span className="tabular border-b border-line bg-surface/50 px-2 py-1.5 text-right text-stone">
                {i + 1}.
              </span>
              {[2 * i, 2 * i + 1].map((k) =>
                moves[k] ? (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPly(k + 1)}
                    aria-current={ply === k + 1 ? "step" : undefined}
                    className={`border-b border-line px-2 py-1.5 text-left font-medium ${ply === k + 1 ? "bg-bordeaux text-cream" : "hover:bg-surface"}`}
                  >
                    {moves[k]!.san}
                  </button>
                ) : (
                  <span key={k} className="border-b border-line" />
                ),
              )}
            </li>
          ))}
        </ol>
        <EnginePanel fen={fen} />
        {analysis}
      </div>
    </div>
  );
}
