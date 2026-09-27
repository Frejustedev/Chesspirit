/**
 * Puzzles de base (positions de mat classiques, vérifiées par test).
 * La base complète (table `puzzles`) arrive avec l'académie ; ceci sert de repli.
 */
export type Puzzle = {
  id: string;
  fen: string;
  /** Coups UCI : joueur, réponse, joueur… */
  solution: string[];
  theme: "backRank" | "smothered" | "scholar" | "queenSacrifice";
  mateIn: number;
};

export const BASE_PUZZLES: Puzzle[] = [
  {
    id: "philidor",
    fen: "5r1k/6pp/7N/8/2Q5/8/5PPP/6K1 w - - 0 1",
    solution: ["c4g8", "f8g8", "h6f7"],
    theme: "smothered",
    mateIn: 2,
  },
  {
    id: "back-rank",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solution: ["d1d8"],
    theme: "backRank",
    mateIn: 1,
  },
  {
    id: "philidor-black",
    fen: "6k1/5ppp/8/2q5/8/7n/6PP/5R1K b - - 0 1",
    solution: ["c5g1", "f1g1", "h3f2"],
    theme: "smothered",
    mateIn: 2,
  },
  {
    id: "scholar",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["h5f7"],
    theme: "scholar",
    mateIn: 1,
  },
  {
    id: "back-rank-2",
    fen: "6k1/pp3ppp/8/8/8/1Q6/5PPP/2R3K1 w - - 0 1",
    solution: ["c1c8"],
    theme: "backRank",
    mateIn: 1,
  },
];

/** Puzzle du jour : rotation déterministe selon la date (fuseau de Porto-Novo). */
export function puzzleOfTheDay(date = new Date()): Puzzle {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(date);
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return BASE_PUZZLES[n % BASE_PUZZLES.length]!;
}
