import "server-only";
import type { PaymentProvider } from "./types";
import { fakeProvider } from "./fake";
import { fedapayProvider } from "./fedapay";
import { kkiapayProvider } from "./kkiapay";

export type ProviderId = "fake" | "fedapay" | "kkiapay";

export function activeProviderId(): ProviderId {
  const p = (process.env.PAYMENT_PROVIDER ?? "fake") as ProviderId;
  return ["fake", "fedapay", "kkiapay"].includes(p) ? p : "fake";
}

/** Renvoie le prestataire demandé s'il est configuré (le factice est refusé en production). */
export function getProvider(id: ProviderId = activeProviderId()): PaymentProvider | null {
  switch (id) {
    case "fake": {
      const secret = process.env.FAKE_PAYMENT_SECRET;
      if (!secret || (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_PAYMENTS !== "true")) return null;
      return fakeProvider(secret);
    }
    case "fedapay": {
      const { FEDAPAY_SECRET_KEY: secretKey, FEDAPAY_WEBHOOK_SECRET: webhookSecret } = process.env;
      if (!secretKey || !webhookSecret) return null;
      return fedapayProvider({ secretKey, webhookSecret, env: process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox" });
    }
    case "kkiapay": {
      const { KKIAPAY_PUBLIC_KEY: publicKey, KKIAPAY_PRIVATE_KEY: privateKey, KKIAPAY_SECRET: secret } = process.env;
      if (!publicKey || !privateKey || !secret) return null;
      return kkiapayProvider({ publicKey, privateKey, secret, sandbox: process.env.KKIAPAY_SANDBOX !== "false" });
    }
  }
}
