/** Courbe de cote en SVG (rendu serveur, aucune bibliothèque). */
export function RatingChart({
  points,
  label,
}: {
  points: { date: string; rating: number }[];
  label: string;
}) {
  if (points.length < 2) return null;
  const W = 640;
  const H = 220;
  const P = { l: 44, r: 12, t: 12, b: 28 };
  const xs = points.map((p) => Date.parse(p.date));
  const ys = points.map((p) => p.rating);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const lo = Math.floor((Math.min(...ys) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...ys) + 20) / 50) * 50;
  const X = (x: number) => P.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (y: number) => P.t + (1 - (y - lo) / Math.max(1, hi - lo)) * (H - P.t - P.b);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${X(Date.parse(p.date)).toFixed(1)},${Y(p.rating).toFixed(1)}`)
    .join(" ");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} stroke="var(--color-line)" />
            <text x={P.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-stone)">
              {t}
            </text>
          </g>
        ))}
        <path
          d={`${d} L${X(x1)},${H - P.b} L${X(x0)},${H - P.b} Z`}
          fill="var(--color-gold)"
          opacity="0.12"
        />
        <path
          d={d}
          fill="none"
          stroke="var(--color-bordeaux)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <circle
            key={p.date + p.rating}
            cx={X(Date.parse(p.date))}
            cy={Y(p.rating)}
            r="3.2"
            fill="var(--color-paper)"
            stroke="var(--color-bordeaux)"
            strokeWidth="1.6"
          />
        ))}
      </svg>
    </figure>
  );
}
