import type { PaymentProvider, PaymentStatus } from "./types";
import { hmacHex, safeEqual } from "./crypto";

/**
 * FedaPay (Mobile Money MTN, Moov, Celtiis et carte). API REST v1.
 * Documentation : https://docs.fedapay.com — webhooks signés « t=…,s=… » (HMAC-SHA256).
 */
export function fedapayProvider(opts: {
  secretKey: string;
  webhookSecret: string;
  env: "sandbox" | "live";
}): PaymentProvider {
  const base =
    opts.env === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${opts.secretKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`FedaPay ${path} : ${res.status} ${await res.text()}`);
    return res.json() as Promise<Record<string, unknown>>;
  };
  return {
    id: "fedapay",
    async createCheckout(input) {
      const created = await call("/transactions", {
        description: input.description,
        amount: input.amountXof,
        currency: { iso: "XOF" },
        callback_url: input.returnUrl,
        custom_metadata: { payment_id: input.paymentId },
        customer: {
          firstname: input.customer.firstName,
          lastname: input.customer.lastName,
          email: input.customer.email ?? undefined,
          phone_number: input.customer.phone
            ? { number: input.customer.phone.replace(/^\+229/, ""), country: "bj" }
            : undefined,
        },
      });
      const tx = (created["v1/transaction"] ?? created.transaction ?? created) as { id: number };
      const token = (await call(`/transactions/${tx.id}/token`, {})) as {
        token: string;
        url: string;
      };
      return { providerRef: String(tx.id), checkoutUrl: token.url };
    },
    async verifyWebhook(rawBody, headers) {
      const header = headers.get("x-fedapay-signature") ?? "";
      const parts = Object.fromEntries(
        header.split(",").map((p) => p.split("=") as [string, string]),
      );
      if (!parts.t || !parts.s) return null;
      if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return null;
      if (!safeEqual(parts.s, hmacHex(opts.webhookSecret, `${parts.t}.${rawBody}`))) return null;
      const evt = JSON.parse(rawBody) as {
        name: string;
        entity: { id: number; status: string; custom_metadata?: { payment_id?: string } };
      };
      const map: Record<string, PaymentStatus> = {
        approved: "succeeded",
        transferred: "succeeded",
        declined: "failed",
        canceled: "cancelled",
        pending: "pending",
      };
      return {
        type: evt.name,
        providerRef: String(evt.entity.id),
        paymentId: evt.entity.custom_metadata?.payment_id,
        status: map[evt.entity.status] ?? "pending",
      };
    },
  };
}
