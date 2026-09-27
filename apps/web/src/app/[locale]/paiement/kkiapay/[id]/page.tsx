import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/payments";
import { env } from "@/lib/env";

export const metadata: Metadata = { robots: { index: false } };

/** Paiement via le widget KKiaPay (alternative à FedaPay). */
export default async function KkiapayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!getProvider("kkiapay") || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: pay } = await createAdminClient().from("payments").select("id, amount_xof, status").eq("id", id).maybeSingle();
  if (!pay || pay.status !== "pending") notFound();
  return (
    <div className="mx-auto max-w-md px-4 py-14 text-center">
      <script src="https://cdn.kkiapay.me/k.js" async />
      {/* @ts-expect-error -- élément personnalisé fourni par le script KKiaPay */}
      <kkiapay-widget
        amount={pay.amount_xof}
        key={process.env.KKIAPAY_PUBLIC_KEY}
        sandbox={process.env.KKIAPAY_SANDBOX !== "false" ? "true" : "false"}
        data={JSON.stringify({ payment_id: pay.id })}
        callback={`${env.siteUrl}/paiement/retour?payment=${pay.id}`}
      />
    </div>
  );
}
