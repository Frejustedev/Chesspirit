"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { useTranslations } from "next-intl";
import { Board } from "./board";
import type { Puzzle } from "@/lib/puzzles";

type Status = "playing" | "wrong" | "solved";

export function PuzzleBoard({
  puzzle,
  compact = false,
  onDone,
}: {
  puzzle: Puzzle;
  compact?: boolean;
  /** Fin de la tentative : résultat et coups joués par la personne (UCI), vérifiables par le serveur. */
  onDone?: (solved: boolean, moves: string[]) => void;
}) {
  const t = useTranslations("puzzle");
  const [game, setGame] = useState(() => new Chess(puzzle.fen));
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [last, setLast] = useState<[string, string] | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [played, setPlayed] = useState<string[]>([]);
  const side = puzzle.fen.split(" ")[1] === "b" ? "b" : "w";
  const fen = game.fen();

  const legalTargets = useCallback(
    (from: string) =>
      status === "solved"
        ? []
        : game.moves({ square: from as never, verbose: true }).map((m) => m.to),
    [game, status],
  );

  function onMove(from: string, to: string, promotion?: string) {
    const expected = puzzle.solution[step];
    const uci = `${from}${to}${promotion ?? ""}`;
    const g = new Chess(game.fen());
    const mv = g.move({ from, to, promotion: promotion ?? "q" });
    if (!mv) return;
    const moves = [...played, `${from}${to}${promotion ?? ""}`];
    setPlayed(moves);
    if (
      uci !== expected &&
      !(expected?.startsWith(uci) && !promotion) &&
      !(g.isCheckmate() && step === puzzle.solution.length - 1)
    ) {
      setBad(to);
      setStatus("wrong");
      onDone?.(false, moves);
      return;
    }
    setBad(null);
    setLast([from, to]);
    const reply = puzzle.solution[step + 1];
    if (!reply || g.isCheckmate()) {
      setGame(g);
      setStatus("solved");
      onDone?.(true, moves);
      return;
    }
    g.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
    setGame(g);
    setStatus("playing");
    setTimeout(() => setLast([reply.slice(0, 2), reply.slice(2, 4)]), 0);
    setStep(step + 2);
  }

  function reset() {
    setGame(new Chess(puzzle.fen));
    setPlayed([]);
    setStep(0);
    setStatus("playing");
    setLast(null);
    setBad(null);
  }

  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    for (const row of game.board())
      for (const p of row) if (p && p.type === "k" && p.color === turn) return p.square;
    return null;
  }, [game]);

  return (
    <div>
      <Board
        fen={fen}
        orientation={side}
        interactive={status !== "solved"}
        legalTargets={legalTargets}
        onMove={onMove}
        lastMove={last}
        checkSquare={checkSquare}
        highlight={bad ? { [bad]: "bad" } : undefined}
        label={t("boardLabel")}
      />
      <div
        className={`mt-3 flex min-h-11 items-center justify-between gap-3 ${compact ? "text-sm" : ""}`}
        aria-live="polite"
      >
        <p className="font-sans">
          {status === "solved" ? (
            <span className="font-semibold text-success">{t("solved")}</span>
          ) : status === "wrong" ? (
            <span className="font-semibold text-danger">{t("wrong")}</span>
          ) : (
            <span>
              {t(side === "w" ? "whiteToPlay" : "blackToPlay")} ·{" "}
              {t("mateIn", { n: puzzle.mateIn })}
            </span>
          )}
        </p>
        {status !== "playing" || step > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-full border border-current px-4 text-sm font-semibold"
          >
            {t("retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
