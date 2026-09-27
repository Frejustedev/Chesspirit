import { PieceSvg } from "@/components/icons/pieces";

/**
 * Illustrations des produits (dessinées, pas de photos inventées). Une image réelle
 * (image_url) les remplace dès que l'équipe l'ajoute depuis l'administration.
 */
export const ART_KEYS = [
  "board",
  "board-wood",
  "pieces",
  "clock",
  "book",
  "bag",
  "shirt",
  "pack",
  "gift",
] as const;

function Board({ light, dark }: { light: string; dark: string }) {
  const cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      cells.push(
        <rect
          key={`${r}${c}`}
          x={40 + c * 15}
          y={30 + r * 15}
          width={15}
          height={15}
          fill={(r + c) % 2 ? dark : light}
        />,
      );
  return (
    <g transform="skewX(-8) translate(18 0)">
      <rect x={34} y={24} width={132} height={132} rx={4} fill="var(--color-ink)" />
      {cells}
    </g>
  );
}

export function ProductArt({
  art,
  imageUrl,
  alt,
  className = "",
}: {
  art: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
}) {
  if (imageUrl)
    // eslint-disable-next-line @next/next/no-img-element -- images de la boutique hébergées par le stockage
    return <img src={imageUrl} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
  const bg = art === "gift" || art === "pack" ? "var(--color-bordeaux-soft)" : "var(--color-cream)";
  return (
    <svg viewBox="0 0 200 180" role="img" aria-label={alt} className={className}>
      <rect width="200" height="180" fill={bg} />
      {art === "board" ? <Board light="#eeeed2" dark="#6f8f55" /> : null}
      {art === "board-wood" ? <Board light="#e8cfa2" dark="#8a5a33" /> : null}
      {art === "pieces" ? (
        <g>
          <svg x={28} y={52} width={60} height={100} viewBox="0 0 45 45">
            <PieceSvg kind="k" color="b" />
          </svg>
          <svg x={74} y={62} width={56} height={90} viewBox="0 0 45 45">
            <PieceSvg kind="q" color="w" />
          </svg>
          <svg x={120} y={82} width={48} height={70} viewBox="0 0 45 45">
            <PieceSvg kind="n" color="b" />
          </svg>
        </g>
      ) : null}
      {art === "clock" ? (
        <g>
          <rect x={40} y={60} width={120} height={70} rx={10} fill="var(--color-ink)" />
          <rect x={52} y={74} width={44} height={30} rx={3} fill="#cfe3c4" />
          <rect x={104} y={74} width={44} height={30} rx={3} fill="#cfe3c4" />
          <text
            x={74}
            y={95}
            textAnchor="middle"
            fontSize="15"
            fontFamily="monospace"
            fill="#1c1815"
          >
            5:00
          </text>
          <text
            x={126}
            y={95}
            textAnchor="middle"
            fontSize="15"
            fontFamily="monospace"
            fill="#1c1815"
          >
            4:58
          </text>
          <rect x={60} y={50} width={28} height={10} rx={3} fill="var(--color-gold)" />
          <rect x={112} y={52} width={28} height={8} rx={3} fill="var(--color-stone)" />
        </g>
      ) : null}
      {art === "book" ? (
        <g>
          <rect x={62} y={30} width={80} height={120} rx={4} fill="var(--color-bordeaux)" />
          <rect x={62} y={30} width={10} height={120} fill="#4f1320" />
          <rect x={84} y={52} width={44} height={44} fill="var(--color-cream)" />
          <svg x={88} y={54} width={36} height={40} viewBox="0 0 45 45">
            <PieceSvg kind="n" color="b" />
          </svg>
          <rect x={84} y={108} width={44} height={4} fill="var(--color-gold)" />
          <rect x={90} y={118} width={32} height={3} fill="var(--color-gold-soft)" />
        </g>
      ) : null}
      {art === "bag" ? (
        <g>
          <path d="M78 62 q22-34 44 0" fill="none" stroke="var(--color-ink)" strokeWidth={6} />
          <rect x={52} y={60} width={96} height={92} rx={10} fill="var(--color-ink)" />
          <svg x={82} y={80} width={36} height={52} viewBox="0 0 45 45">
            <PieceSvg kind="k" color="w" />
          </svg>
        </g>
      ) : null}
      {art === "shirt" ? (
        <g>
          <path
            d="M70 36 l-34 20 12 26 16-8 v76 h72 v-76 l16 8 12-26 -34-20 q-30 18-60 0Z"
            fill="var(--color-paper)"
            stroke="var(--color-ink)"
            strokeWidth={3}
          />
          <svg x={84} y={70} width={32} height={44} viewBox="0 0 45 45">
            <PieceSvg kind="k" color="b" />
          </svg>
        </g>
      ) : null}
      {art === "pack" ? (
        <g>
          <rect x={30} y={70} width={70} height={80} rx={4} fill="var(--color-ink)" />
          <rect x={60} y={50} width={70} height={80} rx={4} fill="var(--color-bordeaux)" />
          <rect x={92} y={34} width={70} height={80} rx={4} fill="var(--color-gold)" />
          <svg x={108} y={44} width={40} height={56} viewBox="0 0 45 45">
            <PieceSvg kind="r" color="w" />
          </svg>
        </g>
      ) : null}
      {art === "gift" ? (
        <g>
          <rect x={36} y={50} width={128} height={82} rx={10} fill="var(--color-bordeaux)" />
          <rect x={36} y={84} width={128} height={10} fill="var(--color-gold)" />
          <rect x={112} y={50} width={10} height={82} fill="var(--color-gold)" />
          <text
            x={52}
            y={76}
            fontSize="15"
            fontFamily="serif"
            fontStyle="italic"
            fill="var(--color-cream)"
          >
            Chesspirit
          </text>
        </g>
      ) : null}
    </svg>
  );
}
