"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PieceSvg, type PieceColor, type PieceKind } from "@/components/icons/pieces";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export type BoardPiece = { type: PieceKind; color: PieceColor };
export type Square = `${(typeof FILES)[number]}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

/** Lit la partie « placement » d'une FEN. */
export function parseFenBoard(fen: string): Map<string, BoardPiece> {
  const map = new Map<string, BoardPiece>();
  const rows = fen.split(" ")[0]!.split("/");
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
      map.set(`${FILES[f]}${8 - i}`, { type: ch.toLowerCase() as PieceKind, color });
      f++;
    }
  });
  return map;
}

export type BoardProps = {
  fen: string;
  orientation?: PieceColor;
  interactive?: boolean;
  /** Cases jouables depuis une case (fourni par chess.js). */
  legalTargets?: (from: string) => string[];
  onMove?: (from: string, to: string, promotion?: PieceKind) => void;
  lastMove?: [string, string] | null;
  checkSquare?: string | null;
  highlight?: Record<string, "good" | "bad">;
  size?: string;
  label?: string;
};

export function Board({
  fen,
  orientation = "w",
  interactive = false,
  legalTargets,
  onMove,
  lastMove,
  checkSquare,
  highlight,
  label,
}: BoardProps) {
  const t = useTranslations("board");
  const pieces = useMemo(() => parseFenBoard(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const targets = useMemo(() => (selected && legalTargets ? legalTargets(selected) : []), [selected, legalTargets]);
  const turn = (fen.split(" ")[1] ?? "w") as PieceColor;

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? FILES : [...FILES].reverse();

  function click(sq: string) {
    if (!interactive) return;
    const p = pieces.get(sq);
    if (selected && targets.includes(sq)) {
      const moving = pieces.get(selected);
      if (moving?.type === "p" && (sq.endsWith("8") || sq.endsWith("1"))) {
        setPromo({ from: selected, to: sq });
      } else {
        onMove?.(selected, sq);
      }
      setSelected(null);
      return;
    }
    if (p && p.color === turn) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  }

  const pieceName = (p: BoardPiece) => `${t(`pieces.${p.type}`)} ${t(p.color === "w" ? "white" : "black")}`;

  return (
    <div className="relative select-none" role="group" aria-label={label ?? t("board")}>
      <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(28_24_21/0.6),0_12px_30px_-12px_rgb(28_24_21/0.6)]">
        {ranks.map((r, ri) =>
          files.map((f, fi) => {
            const sq = `${f}${r}`;
            const dark = (FILES.indexOf(f) + r) % 2 === 1;
            const p = pieces.get(sq);
            const isTarget = targets.includes(sq);
            const isLast = lastMove?.includes(sq);
            const hl = highlight?.[sq];
            const Tag = interactive ? "button" : "div";
            return (
              <Tag
                key={sq}
                {...(interactive ? { type: "button" as const, onClick: () => click(sq) } : {})}
                aria-label={interactive ? `${sq}${p ? `, ${pieceName(p)}` : ""}` : undefined}
                aria-pressed={interactive ? selected === sq : undefined}
                className="relative aspect-square outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bordeaux"
                style={{ background: dark ? "var(--color-square-dark)" : "var(--color-square-light)" }}
              >
                {isLast ? <span className="absolute inset-0 bg-gold/35" /> : null}
                {selected === sq ? <span className="absolute inset-0 bg-bordeaux/30" /> : null}
                {checkSquare === sq ? (
                  <span className="absolute inset-0 bg-[radial-gradient(circle,rgb(142_31_47/0.75)_0%,transparent_70%)]" />
                ) : null}
                {hl ? (
                  <span className={`absolute inset-0 ${hl === "good" ? "bg-success/35" : "bg-danger/35"}`} />
                ) : null}
                {fi === 0 ? (
                  <span
                    className={`pointer-events-none absolute left-0.5 top-0 font-sans text-[0.6rem] font-semibold sm:text-[0.7rem] ${dark ? "text-square-light" : "text-square-dark"}`}
                  >
                    {r}
                  </span>
                ) : null}
                {ri === 7 ? (
                  <span
                    className={`pointer-events-none absolute bottom-0 right-1 font-sans text-[0.6rem] font-semibold sm:text-[0.7rem] ${dark ? "text-square-light" : "text-square-dark"}`}
                  >
                    {f}
                  </span>
                ) : null}
                {p ? (
                  <PieceSvg kind={p.type} color={p.color} className="relative size-full p-[6%] drop-shadow-[0_1px_0_rgb(0_0_0/0.18)]" />
                ) : null}
                {isTarget ? (
                  <span
                    className={`pointer-events-none absolute inset-0 m-auto rounded-full ${p ? "size-[92%] border-[5px] border-ink/35" : "size-[28%] bg-ink/30"}`}
                  />
                ) : null}
              </Tag>
            );
          }),
        )}
      </div>
      {promo ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/60" role="dialog" aria-label={t("promotion")}>
          <div className="flex gap-2 rounded bg-paper p-2 shadow-xl">
            {(["q", "r", "b", "n"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="size-14 rounded hover:bg-cream"
                aria-label={t(`pieces.${k}`)}
                onClick={() => {
                  onMove?.(promo.from, promo.to, k);
                  setPromo(null);
                }}
              >
                <PieceSvg kind={k} color={turn} className="size-full" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
