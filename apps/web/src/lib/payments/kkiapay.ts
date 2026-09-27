import type { PaymentProvider } from "./types";
import { safeEqual } from "./crypto";

/**
 * KKiaPay (alternative). Le paiement se fait via le widget KKiaPay sur la page /paiement/kkiapay/[id] ;
 * le webhook porte l'en-tête « x-kkiapay-secret » et le statut est revérifié auprès de l'API.
 */
export function kkiapayProvider(opts: {
  publicKey: string;
  privateKey: string;
  secret: string;
  sandbox: boolean;
}): PaymentProvider {
  const api = opts.sandbox ? "https://api-sandbox.kkiapay.me" : "https://api.kkiapay.me";
  return {
    id: "kkiapay",
    async createCheckout(input) {
      return {
        providerRef: `pending_${input.paymentId}`,
        checkoutUrl: `/paiement/kkiapay/${input.paymentId}`,
      };
    },
    async verifyWebhook(rawBody, headers) {
      if (!safeEqual(headers.get("x-kkiapay-secret") ?? "", opts.secret)) return null;
      const evt = JSON.parse(rawBody) as {
        transactionId: string;
        stateData?: { payment_id?: string };
        partnerId?: string;
      };
      const res = await fetch(`${api}/api/v1/transactions/status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.publicKey,
          "x-private-key": opts.privateKey,
          "x-secret-key": opts.secret,
        },
        body: JSON.stringify({ transactionId: evt.transactionId }),
      });
      if (!res.ok) return null;
      const st = (await res.json()) as { status: string };
      return {
        type: "transaction.status",
        providerRef: evt.transactionId,
        paymentId: evt.stateData?.payment_id ?? evt.partnerId,
        status:
          st.status === "SUCCESS" ? "succeeded" : st.status === "FAILED" ? "failed" : "pending",
      };
    },
  };
}
