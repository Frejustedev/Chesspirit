import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments";
import { FakeCheckout } from "./fake-checkout";

export const metadata: Metadata = { robots: { index: false } };

/** Page du prestataire factice (développement) : aucune donnée bancaire n'est demandée. */
export default async function FakeCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!getProvider("fake") || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: pay } = await (
    await createClient()
  )
    .from("payments")
    .select("id, amount_xof, description, status")
    .eq("id", id)
    .maybeSingle();
  if (!pay) notFound();
  const t = await getTranslations("payment");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border-2 border-dashed border-gold bg-paper p-6">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gold-deep">
          {t("fakeKicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{t("fakeTitle")}</h1>
        <p className="mt-2 text-stone">{t("fakeText")}</p>
        <p className="mt-5 text-sm text-stone">{pay.description}</p>
        <p className="tabular font-display text-4xl font-semibold">
          {formatXof(pay.amount_xof, locale)}
        </p>
        <FakeCheckout paymentId={pay.id} disabled={pay.status !== "pending"} />
      </div>
    </div>
  );
}
