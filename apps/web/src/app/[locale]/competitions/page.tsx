import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listTournaments } from "@/lib/data/tournaments";
import { TournamentList } from "@/components/tournaments/tournament-list";

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-light sm:text-5xl">{tt("calendarTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{tt("calendarIntro")}</p>
      <h2 className="mt-10 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        {tt("upcoming")}
      </h2>
      {upcoming.length ? (
        <TournamentList tournaments={upcoming} locale={locale} />
      ) : (
        <p className="mt-3 text-stone">{tt("none")}</p>
      )}
      {past.length ? (
        <>
          <h2 className="mt-12 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            {tt("past")}
          </h2>
          <TournamentList tournaments={past} locale={locale} />
        </>
      ) : null}
    </div>
  );
}
