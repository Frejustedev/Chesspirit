import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { listTournaments, type Tournament } from "@/lib/data/tournaments";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Tbc } from "@/components/ui/tbc";
import { IconArrow } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tournament");
  return { title: t("calendarTitle") };
}

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tt = await getTranslations("tournament");
  const [upcoming, past] = await Promise.all([
    listTournaments(),
    listTournaments({ past: true, limit: 20 }),
  ]);

  const Row = ({ t }: { t: Tournament }) => {
    const d = new Date(t.starts_at);
    return (
      <li>
        <Link
          href={`/competitions/${t.slug}`}
          className="group grid grid-cols-[4.2rem_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[5rem_1fr_auto]"
        >
          <span className="rounded-[var(--radius-card)] border border-line bg-paper py-2 text-center">
            <span className="block font-display text-3xl font-semibold leading-none">
              {formatDate(d, locale, { day: "numeric" })}
            </span>
            <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-stone">
              {formatDate(d, locale, { month: "short" })}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-semibold group-hover:text-bordeaux sm:text-2xl">
              {t.name} {t.is_demo ? <DemoBadge /> : null}
            </span>
            <span className="mt-0.5 block text-sm text-stone">
              {[t.city, t.cadence ? tt(`cadence.${t.cadence}`) : null, tt(`status.${t.status}`)]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              {t.entry_fee_xof == null || t.unconfirmed_fields.includes("fee") ? (
                <Tbc />
              ) : t.entry_fee_xof === 0 ? (
                tt("free")
              ) : (
                formatXof(t.entry_fee_xof, locale)
              )}
            </span>
          </span>
          <IconArrow className="size-5 text-stone group-hover:text-bordeaux" />
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{tt("calendarTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{tt("calendarIntro")}</p>
      <h2 className="mt-10 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold-deep">
        {tt("upcoming")}
      </h2>
      {upcoming.length ? (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {upcoming.map((t) => (
            <Row key={t.id} t={t} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-stone">{tt("none")}</p>
      )}
      {past.length ? (
        <>
          <h2 className="mt-12 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold-deep">
            {tt("past")}
          </h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {past.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
