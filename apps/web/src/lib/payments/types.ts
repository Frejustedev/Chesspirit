/** Interface commune des prestataires de paiement. Aucun numéro de carte ne transite par Chesspirit. */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled";

export interface CheckoutInput {
  paymentId: string;
  amountXof: number;
  description: string;
  customer: { firstName: string; lastName: string; email?: string | null; phone?: string | null };
  returnUrl: string;
  webhookUrl: string;
}

export interface CheckoutResult {
  providerRef: string;
  checkoutUrl: string;
}

export interface WebhookEvent {
  paymentId?: string;
  providerRef?: string;
  status: PaymentStatus;
  type: string;
  /** Montant réellement payé selon le prestataire (vérifié contre la base avant confirmation). */
  amountXof?: number;
}

export interface PaymentProvider {
  id: "fake" | "fedapay" | "kkiapay";
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Vérifie la signature du webhook ; renvoie null si invalide. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}
