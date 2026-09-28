import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/ui/auto-refresh";

export const metadata: Metadata = { robots: { index: false } };

/** Retour du prestataire : affiche le statut connu en base (le webhook fait foi). */
export default async function PaymentReturn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { payment } = await searchParams;
  const t = await getTranslations("payment");
  const supabase = await createClient();
  const { data: pay } =
    payment && /^[0-9a-f-]{36}$/.test(payment)
      ? await supabase
          .from("payments")
          .select("id, status, amount_xof, object_type, object_id")
          .eq("id", payment)
          .maybeSingle()
      : { data: null };
  let ticket: string | null = null;
  if (pay?.object_type === "registration") {
    const { data: r } = await supabase
      .from("registrations")
      .select("ticket_code")
      .eq("id", pay.object_id)
      .maybeSingle();
    ticket = r?.ticket_code ?? null;
  }
  let orderNumber: string | null = null;
  if (pay?.object_type === "order") {
    const { data: o } = await supabase
      .from("orders")
      .select("number")
      .eq("id", pay.object_id)
      .maybeSingle();
    orderNumber = o?.number ?? null;
  }
  const status = pay?.status ?? "unknown";
  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      {status === "pending" ? <AutoRefresh seconds={4} /> : null}
      <h1 className="font-display text-4xl font-semibold">{t(`status.${status}`)}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t(`statusText.${status}`)}</p>
      {pay ? (
        <p className="tabular mt-4 text-lg font-semibold">{formatXof(pay.amount_xof, locale)}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {ticket ? (
          <Link
            href={`/billet/${ticket}`}
            className="inline-flex min-h-12 items-center rounded-full bg-bordeaux px-6 font-semibold text-cream hover:bg-ink"
          >
            {t("seeTicket")}
          </Link>
        ) : null}
        {orderNumber ? (
          <Link
            href={`/compte/commandes/${orderNumber}`}
            className="inline-flex min-h-12 items-center rounded-full bg-bordeaux px-6 font-semibold text-cream hover:bg-ink"
          >
            {t("seeOrder")}
          </Link>
        ) : null}
        {pay?.object_type === "booking" ? (
          <Link
            href="/compte/cours"
            className="inline-flex min-h-12 items-center rounded-full bg-bordeaux px-6 font-semibold text-cream hover:bg-ink"
          >
            {t("seeLessons")}
          </Link>
        ) : null}
        <Link
          href="/compte"
          className="inline-flex min-h-12 items-center rounded-full border border-ink/25 px-6 font-semibold hover:bg-cream"
        >
          {t("account")}
        </Link>
      </div>
    </div>
  );
}
