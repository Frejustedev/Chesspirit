/**
 * Puzzles de base (positions de mat classiques, vérifiées par test).
 * La base complète (table `puzzles`) arrive avec l'académie ; ceci sert de repli.
 */
export type Puzzle = {
  id: string;
  fen: string;
  /** Coups UCI : joueur, réponse, joueur… */
  solution: string[];
  theme:
    | "backRank"
    | "smothered"
    | "scholar"
    | "queenSacrifice"
    | "anastasia"
    | "arabian"
    | "boden"
    | "foolsMate"
    | "damiano";
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
  {
    id: "anastasia",
    fen: "5r2/4N1pk/8/8/8/3R4/5PPP/6K1 w - - 0 1",
    solution: ["d3h3"],
    theme: "anastasia",
    mateIn: 1,
  },
  {
    id: "arabian",
    fen: "7k/4R3/5N2/8/8/8/6PP/7K w - - 0 1",
    solution: ["e7h7"],
    theme: "arabian",
    mateIn: 1,
  },
  {
    id: "boden",
    fen: "2kr4/p2n1ppp/8/8/5B2/3B4/PPP2PPP/6K1 w - - 0 1",
    solution: ["d3a6"],
    theme: "boden",
    mateIn: 1,
  },
  {
    id: "fools-mate",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    solution: ["d8h4"],
    theme: "foolsMate",
    mateIn: 1,
  },
  {
    id: "damiano",
    fen: "5rk1/5p2/6P1/8/8/8/6K1/7Q w - - 0 1",
    solution: ["h1h7"],
    theme: "damiano",
    mateIn: 1,
  },
  {
    id: "back-rank-queen",
    fen: "6k1/5ppp/8/8/8/8/Q4PPP/6K1 w - - 0 1",
    solution: ["a2a8"],
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
