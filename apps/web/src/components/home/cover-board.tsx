/**
 * Motif de la couverture du dossier de projet : un damier sombre à peine marqué, quadrillé d'or,
 * qui s'efface vers la gauche, et une courbe de progression d'or qui monte de case en case
 * jusqu'à la case bordeaux du coin. La courbe se trace au chargement (CSS uniquement).
 */
const COLS = 7;
const ROWS = 7;
/** Centres des cases traversées, du bas vers le haut (colonne, rangée). */
const PATH: [number, number][] = [
  [1.9, 7],
  [2.5, 5.5],
  [4.5, 4.5],
  [5.5, 2.5],
  [6.5, 0.5],
];

export function CoverBoard({ className = "" }: { className?: string }) {
  const squares = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r + c) % 2 === 1)
        squares.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} />);
    }
  }
  const d = PATH.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const [ex, ey] = PATH[PATH.length - 1]!;
  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS}`}
      aria-hidden
      className={`pointer-events-none [mask-image:linear-gradient(90deg,transparent,#000_45%)] ${className}`}
      fill="none"
    >
      <g fill="var(--color-cream)" fillOpacity={0.035}>
        {squares}
      </g>
      <rect x={COLS - 1} y={0} width={1} height={1} fill="var(--color-bordeaux)" />
      <g stroke="var(--color-gold)" strokeOpacity={0.22} strokeWidth={0.012}>
        {Array.from({ length: COLS + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i} y1={0} x2={i} y2={ROWS} />
        ))}
        {Array.from({ length: ROWS + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i} x2={COLS} y2={i} />
        ))}
      </g>
      <path
        d={d}
        pathLength={1}
        stroke="var(--color-gold)"
        strokeWidth={0.03}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1,
          ["--len" as string]: 1,
          animation: "draw 2.4s var(--ease-out-soft) 0.3s both",
        }}
      />
      <g fill="var(--color-gold)">
        {PATH.slice(1, -1).map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.07} />
        ))}
        <circle cx={ex} cy={ey} r={0.06} />
      </g>
      <circle cx={ex} cy={ey} r={0.13} stroke="var(--color-gold)" strokeWidth={0.03} />
    </svg>
  );
}
