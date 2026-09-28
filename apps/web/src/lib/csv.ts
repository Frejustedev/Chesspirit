/** Cellule CSV (séparateur « ; ») : guillemets si nécessaire et neutralisation des formules de tableur. */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const safe = /^[=+\-@\t\r\n]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(";");
