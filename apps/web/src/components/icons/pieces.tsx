/**
 * Jeu de pièces Chesspirit, dessiné sur mesure (grille 45×45).
 * Blancs : papier cerné d'encre. Noirs : encre avec filets or.
 */
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

const BASE = "M11 40.5h23a1.5 1.5 0 0 0 1.5-1.5v-1.2a2.3 2.3 0 0 0-2.3-2.3H11.8a2.3 2.3 0 0 0-2.3 2.3V39a1.5 1.5 0 0 0 1.5 1.5Z";

const BODY: Record<PieceKind, string> = {
  p: "M22.5 7.8a5.4 5.4 0 0 1 3.3 9.7c1.4.6 2.4 1.5 2.4 2.6 0 .9-.6 1.6-1.6 2.1 1.6 4.4 3.6 8.8 5.6 13.3H12.8c2-4.5 4-8.9 5.6-13.3-1-.5-1.6-1.2-1.6-2.1 0-1.1 1-2 2.4-2.6a5.4 5.4 0 0 1 3.3-9.7Z",
  r: "M12.5 8.5h4.2v3.3h3.5V8.5h4.6v3.3h3.5V8.5h4.2v6.6l-2.6 2.6v12.1l3.1 5.7H11.9l3.1-5.7V17.7l-2.5-2.6V8.5Z",
  b: "M22.5 4.6a2.4 2.4 0 0 1 1.4 4.3c3.8 2.6 6.2 6.4 6.2 10.1 0 2.4-1 4.3-2.6 5.6 1.8 3.2 3.9 6.9 5.4 10.9H12.1c1.5-4 3.6-7.7 5.4-10.9A7.1 7.1 0 0 1 14.9 19c0-3.7 2.4-7.5 6.2-10.1a2.4 2.4 0 0 1 1.4-4.3Z",
  n: "M14.2 35.5c.2-4.8 2.3-8.1 5.4-10.9-2.6.5-5 1.5-6.6 2.9-1.7 1-3.6-.2-3.4-2 .5-3.6 2.4-6.7 5.1-9.4l.9-4.9 2.8 2.6c.9-.3 1.9-.5 2.9-.6L23.9 9l1.6 3.7c5.7 2.1 9.3 7.7 9.3 14.6 0 3-.4 5.7-1 8.2H14.2Z",
  q: "M8.6 12.9a2.1 2.1 0 1 1 2.6 2l3.6 9.3 2.3-11.5a2.1 2.1 0 1 1 2.5-.2l2.9 10.6 2.9-10.6a2.1 2.1 0 1 1 2.5.2l2.3 11.5 3.6-9.3a2.1 2.1 0 1 1 2.6-2l-3.7 17.2 1.8 5.4H12.5l1.8-5.4-3.7-17.2a2.1 2.1 0 0 1-2-2Z",
  k: "M21.1 3.5h2.8v3h3v2.8h-3v3.3c5.9.6 10.4 4.1 10.4 8.7 0 3.7-2.2 6.1-4.1 8.2l1.6 6H13.2l1.6-6c-1.9-2.1-4.1-4.5-4.1-8.2 0-4.6 4.5-8.1 10.4-8.7V9.3h-3V6.5h3v-3Z",
};

// Filets de détail (encre sur les blancs, or sur les noirs).
const DETAIL: Record<PieceKind, string> = {
  p: "M17.4 22.3h10.2",
  r: "M15 17.7h15M15 29.8h15",
  b: "M25.7 13.1l-5.4 5.4M17.5 24.6h10",
  n: "M19.4 15.6h.01M14.4 24.9c1.3-.6 2.9-1 4.4-1.2M26.3 14.1c2.6 2.4 4 5.7 4 9.6",
  q: "M14.3 30.1h16.4M15.7 26.3c4.3-1.2 9.3-1.2 13.6 0",
  k: "M13.2 29.9h18.6M22.5 14.2v9.2M15.1 25.3c4.6-1.6 10.2-1.6 14.8 0",
};

export function PieceSvg({
  kind,
  color,
  className,
  title,
}: {
  kind: PieceKind;
  color: PieceColor;
  className?: string;
  title?: string;
}) {
  const white = color === "w";
  const fill = white ? "var(--color-paper)" : "var(--color-ink)";
  const stroke = "var(--color-ink)";
  const detail = white ? "var(--color-ink)" : "var(--color-gold)";
  return (
    <svg viewBox="0 0 45 45" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d={BODY[kind]} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <path d={BASE} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <path d={DETAIL[kind]} fill="none" stroke={detail} strokeWidth={kind === "n" ? 1.6 : 1.3} />
        {kind === "n" ? <circle cx={19.6} cy={15.8} r={1.1} fill={detail} /> : null}
      </g>
    </svg>
  );
}
