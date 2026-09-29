import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listTournaments } from "@/lib/data/tournaments";
import { TournamentList } from "@/components/tournaments/tournament-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("competitionHubs");
  return { title: t("liveTitle") };
}

/** Résultats en direct : tournois en cours (vers leur page « direct »), puis les prochains. */
export default async function LiveResultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("competitionHubs");
  const [ongoing, upcoming] = await Promise.all([
    listTournaments({ ongoing: true }),
    listTournaments({ limit: 5 }),
  ]);
  const next = upcoming.filter((u) => !ongoing.some((o) => o.id === u.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("liveTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("liveIntro")}</p>
      <h2 className="mt-10 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        {t("liveNow")}
      </h2>
      {ongoing.length ? (
        <TournamentList tournaments={ongoing} locale={locale} suffix="/direct" />
      ) : (
        <p className="mt-3 text-stone">{t("liveNone")}</p>
      )}
      {next.length ? (
        <>
          <h2 className="mt-12 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            {t("liveNext")}
          </h2>
          <TournamentList tournaments={next} locale={locale} />
        </>
      ) : null}
      <p className="mt-10">
        <Link href="/competitions/archives" className="font-semibold text-accent hover:underline">
          {t("liveArchives")}
        </Link>
      </p>
    </div>
  );
}
