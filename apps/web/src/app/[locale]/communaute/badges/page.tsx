import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LEVELS, XP_RULES, formatDate } from "@chesspirit/shared";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberStanding } from "@/lib/community";
import { tr } from "@/lib/i18n-json";
import { PieceSvg, type PieceKind } from "@/components/icons/pieces";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { LevelCard } from "@/components/community/level-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.badges");
  return { title: t("title"), description: t("intro") };
}

export default async function BadgesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.badges");
  const tc = await getTranslations("community");
  const supabase = await createClient();
  const session = await getSession();
  const [{ data: all }, standing] = await Promise.all([
    supabase.from("badges").select("*").neq("category", "tour").order("position"),
    session?.profile ? memberStanding(session.profile.id, true) : Promise.resolve(null),
  ]);
  const owned = new Set(standing?.badges.map((b) => b.badge_code));
  const tourBadges = standing?.badges.filter((b) => b.badge_code.startsWith("tour:")) ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/badges" />
      </CommunityHeader>
      {standing ? (
        <div className="mt-8 max-w-xl">
          <LevelCard standing={standing} />
        </div>
      ) : (
        <p className="mt-8 text-stone">{t("signIn")}</p>
      )}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("levels")}</h2>
        <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LEVELS.map((l) => (
            <li
              key={l.code}
              className={`rounded-lg border p-3 text-center ${standing?.level.code === l.code ? "border-accent bg-surface" : "border-line"}`}
            >
              <PieceSvg kind={l.piece} color="w" className="mx-auto size-12" />
              <p className="font-display text-lg font-semibold">{tc(`levels.${l.code}`)}</p>
              <p className="tabular text-sm text-stone">{t("fromXp", { xp: l.min })}</p>
            </li>
          ))}
        </ol>
        <h3 className="mt-6 font-semibold">{t("howTo")}</h3>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {(Object.keys(XP_RULES) as (keyof typeof XP_RULES)[]).map((k) => (
            <li key={k}>
              {t(`rules.${k}`)} : <strong className="tabular">+{XP_RULES[k]}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("all")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(all ?? []).map((b) => (
            <li
              key={b.code}
              className={`flex items-center gap-3 rounded-lg border p-3 ${owned.has(b.code) ? "border-gold bg-gold/10" : "border-line opacity-80"}`}
            >
              <PieceSvg kind={b.icon as PieceKind} color="w" className="size-10 shrink-0" />
              <span className="min-w-0">
                <span className="block font-semibold">
                  {tr(b.name, locale)}
                  {owned.has(b.code) ? <span className="sr-only"> — {t("owned")}</span> : null}
                </span>
                <span className="block text-sm text-stone">{tr(b.description, locale)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("passport")}</h2>
        <p className="mt-1 text-stone">{t("passportIntro")}</p>
        {tourBadges.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {tourBadges.map((b) => (
              <li
                key={b.badge_code}
                className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-onaccent"
              >
                {b.context} · {formatDate(b.awarded_at, locale)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone">{t("passportEmpty")}</p>
        )}
      </section>
    </div>
  );
}
