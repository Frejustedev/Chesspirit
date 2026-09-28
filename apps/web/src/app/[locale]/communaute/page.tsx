import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { memberStanding } from "@/lib/community";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { LevelCard } from "@/components/community/level-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community");
  return { title: t("title"), description: t("intro") };
}

const CARDS = [
  ["/communaute/adhesion", "membership"],
  ["/communaute/badges", "badges"],
  ["/communaute/ambassadeurs", "ambassadors"],
  ["/communaute/pronostics", "predictions"],
  ["/communaute/public-contre-le-maitre", "pvm"],
  ["/communaute/awards", "awards"],
] as const;

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const session = await getSession();
  const standing = session?.profile ? await memberStanding(session.profile.id, true) : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute" />
      </CommunityHeader>
      {standing ? (
        <div className="mt-8 max-w-xl">
          <LevelCard standing={standing} />
        </div>
      ) : null}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(([href, key]) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-5 hover:border-bordeaux"
            >
              <span className="font-display text-2xl font-semibold">{t(`nav.${key}`)}</span>
              <span className="mt-2 text-stone">{t(`cards.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
