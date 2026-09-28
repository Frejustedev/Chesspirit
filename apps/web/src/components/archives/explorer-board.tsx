"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Chess } from "chess.js";
import { useRouter } from "@/i18n/navigation";
import { Board } from "@/components/chess/board";

/** Échiquier de l'explorateur : chaque coup joué met à jour l'adresse (partageable). */
export function ExplorerBoard({
  fen,
  moves,
  base,
}: {
  fen: string;
  moves: string[];
  base: string | null;
}) {
  const t = useTranslations("archives");
  const router = useRouter();
  const game = useMemo(() => new Chess(fen), [fen]);
  const legalTargets = useCallback(
    (from: string) =>
      game.moves({ square: from as never, verbose: true }).map((m) => m.to as string),
    [game],
  );
  const href = (list: string[]) => {
    const p = new URLSearchParams();
    if (base) p.set("fen", base);
    if (list.length) p.set("coups", list.join(" "));
    const s = p.toString();
    return `/competitions/archives/position${s ? `?${s}` : ""}`;
  };
  return (
    <div>
      <Board
        fen={fen}
        interactive
        legalTargets={legalTargets}
        label={t("boardLabel")}
        onMove={(from, to, promotion) => {
          const c = new Chess(fen);
          try {
            const m = c.move({ from, to, promotion });
            router.push(href([...moves, m.san]));
          } catch {
            /* coup refusé par l'échiquier */
          }
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!moves.length}
          onClick={() => router.push(href(moves.slice(0, -1)))}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold disabled:opacity-50"
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/competitions/archives/position")}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
        >
          {t("reset")}
        </button>
      </div>
    </div>
  );
}
