import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { qrSvg } from "@/lib/qr";
import { env } from "@/lib/env";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/ui/print-button";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  if (!/^[A-F0-9]{12}$/i.test(code)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("ticket_info", { p_ticket_code: code });
  const info = data?.[0];
  if (!info) notFound();
  const t = await getTranslations("ticket");
  const svg = await qrSvg(`${env.siteUrl}/billet/${code.toUpperCase()}`);
  const ok = info.status === "confirmed";
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-[var(--shadow-card)] print:shadow-none">
        <div className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
          <Logo tone="light" className="text-2xl" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            {t("ticket")}
          </span>
        </div>
        <div className="p-5">
          <p className="text-sm text-stone">{t("player")}</p>
          <p className="font-display text-3xl font-semibold">{info.display_name}</p>
          <p className="mt-4 text-sm text-stone">{t("event")}</p>
          <p className="text-lg font-semibold">{info.tournament_name}</p>
          <p className="first-letter:uppercase">
            {formatDate(info.starts_at, locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {info.venue ? ` · ${info.venue}` : ""}
          </p>
          <div
            className="mx-auto mt-5 w-64 max-w-full [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label={t("qrLabel")}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="tabular mt-2 text-center font-mono text-lg tracking-[0.2em]">
            {code.toUpperCase()}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-dashed border-line pt-4 text-sm">
            <div>
              <dt className="text-stone">{t("status")}</dt>
              <dd className={`font-semibold ${ok ? "text-success" : "text-accent"}`}>
                {t(`status_${info.status}`)}
              </dd>
            </div>
            <div>
              <dt className="text-stone">{t("payment")}</dt>
              <dd className="font-semibold">{t(`payment_${info.payment_status}`)}</dd>
            </div>
          </dl>
          {info.checked_in ? (
            <p className="mt-3 rounded bg-gold-soft/60 px-3 py-2 text-sm font-semibold">
              {t("checkedIn")}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-stone">{t("help")}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
        <PrintButton />
        <Link
          href={`/competitions/${info.tournament_slug}`}
          className="inline-flex min-h-12 items-center rounded-full border border-fg/25 px-5 font-semibold hover:bg-surface"
        >
          {t("seeTournament")}
        </Link>
      </div>
    </div>
  );
}
