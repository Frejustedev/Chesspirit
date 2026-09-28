import type { PaymentProvider } from "./types";
import { hmacHex, safeEqual } from "./crypto";

/**
 * Fournisseur factice (développement et tests) : la page /paiement/test/[id] simule le
 * prestataire, qui appelle ensuite le webhook signé comme le ferait FedaPay.
 */
export function fakeProvider(secret: string): PaymentProvider {
  return {
    id: "fake",
    async createCheckout(input) {
      return {
        providerRef: `fake_${input.paymentId}`,
        checkoutUrl: `/paiement/test/${input.paymentId}`,
      };
    },
    async verifyWebhook(rawBody, headers) {
      const sig = headers.get("x-fake-signature") ?? "";
      const [tPart, sPart] = sig.split(",");
      const ts = tPart?.replace("t=", "") ?? "";
      const s = sPart?.replace("s=", "") ?? "";
      if (!ts || !s || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return null;
      if (!safeEqual(s, hmacHex(secret, `${ts}.${rawBody}`))) return null;
      const body = JSON.parse(rawBody) as {
        payment_id: string;
        status: "succeeded" | "failed" | "pending";
      };
      return {
        paymentId: body.payment_id,
        providerRef: `fake_${body.payment_id}`,
        status: body.status,
        type: `payment.${body.status}`,
      };
    },
  };
}

export function signFake(secret: string, rawBody: string, ts = Math.floor(Date.now() / 1000)) {
  return `t=${ts},s=${hmacHex(secret, `${ts}.${rawBody}`)}`;
}
