/** Montants en francs CFA (XOF), toujours des entiers sans décimales. */
export const CURRENCY = "XOF" as const;

export function assertXof(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Montant XOF invalide : ${amount}`);
  }
  return amount;
}

export function formatXof(amount: number, locale: string = "fr"): string {
  const n = new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${n.replace(/[\u202f\u00a0]/g, " ")} FCFA`;
}
