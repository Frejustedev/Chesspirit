/**
 * Clé de position : les quatre premiers champs de la FEN (placement, trait, roques, prise en passant).
 * Les compteurs de coups sont ignorés pour retrouver une position quel que soit l'ordre des coups.
 */
export function fenKey(fen: string): string | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const [placement, side, castling, ep] = parts as [string, string, string, string];
  if (!/^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/.test(placement)) return null;
  if (side !== "w" && side !== "b") return null;
  if (!/^(-|K?Q?k?q?)$/.test(castling) || castling === "") return null;
  if (!/^(-|[a-h][36])$/.test(ep)) return null;
  return `${placement} ${side} ${castling} ${ep}`;
}
