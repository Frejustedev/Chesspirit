import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { onlinePaymentsEnabled } from "@/lib/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("faq");
  return { title: t("title") };
}

const KEYS = [
  "account",
  "register",
  "payment",
  "onsite",
  "rating",
  "minors",
  "data",
  "organizers",
] as const;

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  // Tant que le paiement en ligne n'est pas branché, la réponse décrit le paiement sur place.
  const online = await onlinePaymentsEnabled();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <h1 className="font-display text-5xl font-semibold">{t("title")}</h1>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {KEYS.map((k) => (
          <details key={k} className="group py-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-semibold">
              {t(`q.${k}`)}
              <span aria-hidden className="text-accent transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-3 font-serif text-lg text-fg/85">
              {k === "payment" && !online ? t("a.paymentOnSite") : t(`a.${k}`)}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
