"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { useTranslations } from "next-intl";

type Info = { depth: number; cp: number | null; mate: number | null; pv: string[] };

/**
 * Analyse Stockfish (WebAssembly, GPL v3) dans un Web Worker séparé.
 * Le moteur n'est téléchargé (≈1,8 Mo) qu'à la demande de l'utilisateur.
 */
export function EnginePanel({ fen }: { fen: string }) {
  const t = useTranslations("engine");
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const worker = useRef<Worker | null>(null);
  const turn = fen.split(" ")[1] === "b" ? -1 : 1;

  useEffect(() => {
    if (!enabled) return;
    const w = new Worker("/vendor/stockfish/stockfish-19-lite-single.js");
    worker.current = w;
    w.onmessage = (e: MessageEvent<string>) => {
      const line = String(e.data);
      if (line === "readyok") setReady(true);
      if (line.startsWith("info") && line.includes(" pv ")) {
        const depth = Number(/ depth (\d+)/.exec(line)?.[1] ?? 0);
        const cp = /score cp (-?\d+)/.exec(line);
        const mate = /score mate (-?\d+)/.exec(line);
        const pv = line.split(" pv ")[1]!.trim().split(" ");
        if (/ multipv (\d+)/.exec(line)?.[1] && /multipv 1\b/.test(line) === false) return;
        setInfo({ depth, cp: cp ? Number(cp[1]) : null, mate: mate ? Number(mate[1]) : null, pv });
      }
    };
    w.postMessage("uci");
    w.postMessage("isready");
    return () => {
      w.postMessage("quit");
      w.terminate();
      worker.current = null;
      setReady(false);
    };
  }, [enabled]);

  useEffect(() => {
    const w = worker.current;
    if (!w || !ready) return;
    setInfo(null);
    w.postMessage("stop");
    w.postMessage(`position fen ${fen}`);
    w.postMessage("go depth 18");
  }, [fen, ready]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="mt-4 inline-flex min-h-11 items-center rounded-full border border-fg/25 px-4 font-semibold hover:bg-surface"
      >
        {t("start")}
      </button>
    );
  }

  // Évaluation du point de vue des Blancs.
  const whiteCp = info?.cp != null ? info.cp * turn : null;
  const whiteMate = info?.mate != null ? info.mate * turn : null;
  const pct =
    whiteMate != null
      ? whiteMate > 0
        ? 100
        : 0
      : whiteCp != null
        ? 50 + 50 * (2 / (1 + Math.exp(-0.004 * whiteCp)) - 1)
        : 50;
  const label =
    whiteMate != null
      ? `#${whiteMate}`
      : whiteCp != null
        ? `${whiteCp >= 0 ? "+" : ""}${(whiteCp / 100).toFixed(2)}`
        : "…";
  let san: string[] = [];
  if (info) {
    const c = new Chess(fen);
    for (const uci of info.pv.slice(0, 8)) {
      try {
        san.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
      } catch {
        break;
      }
    }
  } else san = [];

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-line p-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div
          className="relative h-3 flex-1 overflow-hidden rounded-full bg-ink"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={t("bar")}
        >
          <div
            className="absolute inset-y-0 left-0 bg-paper transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tabular w-16 text-right font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-sm text-stone">
        {ready ? (info ? t("depth", { depth: info.depth }) : t("thinking")) : t("loading")}
      </p>
      {san.length ? <p className="mt-1 font-medium">{san.join(" ")}</p> : null}
      <p className="mt-2 text-xs text-stone">
        {t("license")}{" "}
        <a href="/vendor/stockfish/Copying.txt" className="underline">
          GPL v3
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/nmrugg/stockfish.js/tree/v19.0.0"
          className="underline"
          rel="noopener"
        >
          {t("source")}
        </a>
      </p>
      <button
        type="button"
        onClick={() => setEnabled(false)}
        className="mt-2 min-h-11 text-sm font-semibold text-accent"
      >
        {t("stop")}
      </button>
    </div>
  );
}
