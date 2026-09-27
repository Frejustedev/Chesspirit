/** Outils PGN sans dépendance : découpage d'un fichier multi-parties et lecture des en-têtes. */
export interface PgnGame {
  headers: Record<string, string>;
  movetext: string;
  raw: string;
}

export function splitPgn(content: string): string[] {
  const text = content
    .replace(/\r\n?/g, "\n")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) return [];
  const games: string[] = [];
  let current: string[] = [];
  let inMoves = false;
  for (const line of text.split("\n")) {
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isHeader && inMoves) {
      games.push(current.join("\n").trim());
      current = [];
      inMoves = false;
    }
    if (!isHeader && line.trim() !== "") inMoves = true;
    current.push(line);
  }
  if (current.join("").trim()) games.push(current.join("\n").trim());
  return games;
}

export function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const re = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) headers[m[1]!] = m[2]!.replace(/\\(.)/g, "$1");
  return headers;
}

export function parsePgn(content: string): PgnGame[] {
  return splitPgn(content).map((raw) => ({
    raw,
    headers: parseHeaders(raw),
    movetext: raw.replace(/^\s*\[.*\]\s*$/gm, "").trim(),
  }));
}

export function buildPgn(headers: Record<string, string>, movetext: string): string {
  const order = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];
  const keys = [
    ...order.filter((k) => k in headers),
    ...Object.keys(headers).filter((k) => !order.includes(k)),
  ];
  const head = keys
    .map((k) => `[${k} "${String(headers[k]).replace(/(["\\])/g, "\\$1")}"]`)
    .join("\n");
  return `${head}\n\n${movetext.trim()}\n`;
}

/** Normalise le nom de joueur pour le rapprochement automatique partie ↔ joueur. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .sort()
    .join(" ");
}
