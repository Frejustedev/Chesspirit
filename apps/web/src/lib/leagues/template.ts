/** Modèle des 9 championnats (règles du dossier de projet, modifiables ensuite en base). */
export const LEAGUE_TEMPLATE = (() => {
  const formats = {
    classical: {
      base: 60,
      inc: 30,
      closed: "round_robin",
      rounds: 11,
      note: { fr: "Une ronde toutes les deux semaines", en: "One round every two weeks" },
      slug: "classique",
    },
    rapid: {
      base: 15,
      inc: 10,
      closed: "double_round_robin",
      rounds: 22,
      note: { fr: "22 rondes sur 4 journées", en: "22 rounds over 4 matchdays" },
      slug: "rapide",
    },
    blitz: {
      base: 3,
      inc: 2,
      closed: "double_round_robin",
      rounds: 22,
      note: { fr: "22 rondes sur 2 journées", en: "22 rounds over 2 matchdays" },
      slug: "blitz",
    },
  } as const;
  const out: {
    division: "l1" | "l2" | "amateur";
    cadence: "classical" | "rapid" | "blitz";
    format: string;
    size: number | null;
    base_minutes: number;
    increment_seconds: number;
    rounds_count: number | null;
    schedule_note: { fr: string; en: string };
    slugSuffix: string;
  }[] = [];
  for (const division of ["l1", "l2", "amateur"] as const)
    for (const cadence of ["classical", "rapid", "blitz"] as const) {
      const f = formats[cadence];
      const amateur = division === "amateur";
      out.push({
        division,
        cadence,
        format: amateur ? "swiss" : f.closed,
        size: amateur ? null : 12,
        base_minutes: f.base,
        increment_seconds: f.inc,
        rounds_count: amateur ? null : f.rounds,
        schedule_note: amateur
          ? { fr: "Système suisse, une journée par mois", en: "Swiss system, one matchday a month" }
          : f.note,
        slugSuffix: `${division}-${f.slug}`,
      });
    }
  return out;
})();

export const STAGE_COEFFICIENTS = { regular: 1, major: 1.5, online: 0.5, masters: 1 } as const;

/** Répartition initiale : 12 premiers en Ligue 1, 12 suivants en Ligue 2, les autres en Amateur. */
export function allocateByRating<T extends { rating: number | null }>(players: T[], size = 12) {
  const sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return {
    l1: sorted.slice(0, size),
    l2: sorted.slice(size, 2 * size),
    amateur: sorted.slice(2 * size),
  };
}

/** Montées, descentes et barrage proposés à partir des classements finaux. */
export function seasonMovements(
  l1: { player_id: string; rank: number }[],
  l2: { player_id: string; rank: number }[],
  rules: {
    promoted?: number;
    relegated?: number;
    playoff?: { upper_rank?: number; lower_rank?: number };
  },
) {
  const up = rules.promoted ?? 2;
  const down = rules.relegated ?? 2;
  const n1 = l1.length;
  return {
    promoted: l2.filter((r) => r.rank <= up).map((r) => r.player_id),
    relegated: l1.filter((r) => r.rank > n1 - down).map((r) => r.player_id),
    playoff: [
      l1.find((r) => r.rank === (rules.playoff?.upper_rank ?? 10))?.player_id ?? null,
      l2.find((r) => r.rank === (rules.playoff?.lower_rank ?? 3))?.player_id ?? null,
    ] as [string | null, string | null],
  };
}
