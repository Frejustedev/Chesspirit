/**
 * Export au format TRF de la FIDE (TRF16, lignes 001 joueurs et 012 à 132 en-tête).
 * Référence : FIDE Handbook C.04, annexe « TRF16 ».
 */
export interface TrfTournament {
  name: string;
  city: string;
  federation: string;
  startDate: string; // AAAA/MM/JJ
  endDate: string;
  chiefArbiter: string;
  timeControl: string;
  rounds: number;
  roundDates: string[]; // AA/MM/JJ
}

export interface TrfPlayer {
  startNo: number;
  sex: "m" | "w" | " ";
  title: string; // GM, IM, FM, CM, WGM... ou vide
  name: string; // « Nom, Prénom »
  rating: number | null;
  federation: string; // BEN
  fideId: string | null;
  birthDate: string | null; // AAAA/MM/JJ
  points: number;
  rank: number;
  rounds: TrfRound[];
}

export interface TrfRound {
  opponent: number | null; // numéro de départ ; null = pas d'adversaire
  color: "w" | "b" | "-";
  result: "1" | "0" | "=" | "+" | "-" | "H" | "F" | "U" | "Z" | " ";
}

const pad = (s: string | number, n: number, right = false) => {
  const str = String(s);
  if (str.length >= n) return str.slice(0, n);
  return right ? str.padEnd(n, " ") : str.padStart(n, " ");
};

export function trfPlayerLine(p: TrfPlayer): string {
  let line = "001";
  line += " " + pad(p.startNo, 4);
  line += " " + pad(p.sex, 1);
  line += pad(p.title, 3);
  line += " " + pad(p.name, 33, true);
  line += " " + pad(p.rating ?? "", 4);
  line += " " + pad(p.federation, 3, true);
  line += " " + pad(p.fideId ?? "", 11);
  line += " " + pad(p.birthDate ?? "", 10, true);
  line += " " + pad(p.points.toFixed(1), 4);
  line += " " + pad(p.rank, 4);
  for (const r of p.rounds) {
    line += "  " + pad(r.opponent ?? "0000", 4) + " " + r.color + " " + r.result;
  }
  return line;
}

export function exportTrf(t: TrfTournament, players: TrfPlayer[]): string {
  const lines = [
    `012 ${t.name}`,
    `022 ${t.city}`,
    `032 ${t.federation}`,
    `042 ${t.startDate}`,
    `052 ${t.endDate}`,
    `062 ${players.length}`,
    `072 ${players.filter((p) => p.rating).length}`,
    `082 0`,
    `092 Individual: Swiss-System`,
    `102 ${t.chiefArbiter}`,
    `122 ${t.timeControl}`,
    `132${" ".repeat(88)}${t.roundDates.map((d) => pad(d, 8, true)).join("  ")}`,
    ...players.map(trfPlayerLine),
  ];
  return lines.join("\n") + "\n";
}

/** Import minimal des lignes 001 d'un TRF (joueurs, points, rang). */
export function parseTrfPlayers(
  trf: string,
): Pick<TrfPlayer, "startNo" | "name" | "rating" | "fideId" | "points" | "rank">[] {
  return trf
    .split(/\r?\n/)
    .filter((l) => l.startsWith("001"))
    .map((l) => ({
      startNo: parseInt(l.slice(4, 8), 10),
      name: l.slice(14, 47).trim(),
      rating: parseInt(l.slice(48, 52), 10) || null,
      fideId: l.slice(57, 68).trim() || null,
      points: parseFloat(l.slice(80, 84)),
      rank: parseInt(l.slice(85, 89), 10),
    }));
}
