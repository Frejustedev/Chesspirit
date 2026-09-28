import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";
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
      if (
        !secret ||
        (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_PAYMENTS !== "true")
      )
        return null;
      return fakeProvider(secret);
    }
    case "fedapay": {
      const { FEDAPAY_SECRET_KEY: secretKey, FEDAPAY_WEBHOOK_SECRET: webhookSecret } = process.env;
      if (!secretKey || !webhookSecret) return null;
      return fedapayProvider({
        secretKey,
        webhookSecret,
        env: process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox",
      });
    }
    case "kkiapay": {
      const {
        KKIAPAY_PUBLIC_KEY: publicKey,
        KKIAPAY_PRIVATE_KEY: privateKey,
        KKIAPAY_SECRET: secret,
      } = process.env;
      if (!publicKey || !privateKey || !secret) return null;
      return kkiapayProvider({
        publicKey,
        privateKey,
        secret,
        sandbox: process.env.KKIAPAY_SANDBOX !== "false",
      });
    }
  }
}

/**
 * Paiement en ligne réellement possible : un prestataire est configuré et l'interrupteur
 * « payments_online » (Administration → Réglages) est actif. Sinon, seuls le paiement sur place
 * et la gratuité sont proposés, et les parcours payants sont fermés avant toute réservation.
 */
export const onlinePaymentsEnabled = cache(async (): Promise<boolean> => {
  if (!getProvider()) return false;
  try {
    const db = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await db
      .from("feature_flags")
      .select("enabled")
      .eq("key", "payments_online")
      .maybeSingle();
    return data?.enabled !== false;
  } catch {
    return true;
  }
});
