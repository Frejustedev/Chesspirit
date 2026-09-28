import type { WebhookEvent } from "./types";

/**
 * Un paiement « réussi » n'est accepté que si le prestataire confirme exactement le montant
 * attendu (le montant du widget KKiaPay est modifiable dans le navigateur). Le fournisseur
 * factice, interne, n'annonce pas de montant.
 */
export function amountMismatch(
  providerId: string,
  event: Pick<WebhookEvent, "status" | "amountXof">,
  expectedXof: number,
): boolean {
  if (event.status !== "succeeded" || providerId === "fake") return false;
  return event.amountXof === undefined || Math.round(event.amountXof) !== expectedXof;
}
