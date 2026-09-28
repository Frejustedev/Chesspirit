"use client";

import { useLocale } from "next-intl";
import { Board } from "@/components/chess/board";
import { PuzzleBoard } from "@/components/chess/puzzle";
import type { ContentPosition } from "@/lib/content";

/** Positions d'une leçon ou d'un épisode : jouables quand une solution est fournie. */
export function PositionList({ positions }: { positions: ContentPosition[] }) {
  const locale = useLocale();
  if (!positions.length) return null;
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {positions.map((p, i) => {
        const caption = p.caption?.[locale as "fr" | "en"] ?? p.caption?.fr ?? "";
        return (
          <figure key={i} className="max-w-md">
            {p.solution?.length ? (
              <PuzzleBoard
                puzzle={{
                  id: `pos-${i}`,
                  fen: p.fen,
                  solution: p.solution,
                  theme: "backRank",
                  mateIn: Math.ceil(p.solution.length / 2),
                }}
              />
            ) : (
              <Board fen={p.fen} label={caption} />
            )}
            {caption ? (
              <figcaption className="mt-2 text-sm text-stone">{caption}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

export function VideoEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-ink">
      <iframe
        src={src}
        title={title}
        className="size-full"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
