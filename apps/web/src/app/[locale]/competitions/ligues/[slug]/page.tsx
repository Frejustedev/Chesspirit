import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Tbc } from "@/components/ui/tbc";
import type { LeagueRules } from "@/lib/data/leagues";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("*, seasons(*)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) return {};
  const t = await getTranslations("leagues");
  return {
    title: `${t(`division.${l.division}`)} ${t(`cadence.${l.cadence}`)} — ${l.seasons?.name}`,
  };
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = await load(slug);
  if (!l || !l.seasons) notFound();
  const t = await getTranslations("leagues");
  const supabase = await createClient();
  const [{ data: standings }, { data: members }, { data: days }] = await Promise.all([
    supabase.from("league_standings").select("*").eq("league_id", l.id).order("rank"),
    supabase.from("public_league_members").select("*").eq("league_id", l.id).order("seed"),
    supabase
      .from("league_matchdays")
      .select("number, scheduled_on, rounds, tournaments(slug, name, status)")
      .eq("league_id", l.id)
      .order("number"),
  ]);
  const rules = (l.seasons.league_rules ?? {}) as LeagueRules;
  const n = standings?.length ?? 0;
  const zone = (rank: number) => {
    if (l.division === "amateur" || !n) return null;
    if (l.division === "l2" && rank <= (rules.promoted ?? 2)) return "up";
    if (l.division === "l2" && rank === (rules.playoff?.lower_rank ?? 3)) return "playoff";
    if (l.division === "l1" && rank === (rules.playoff?.upper_rank ?? 10)) return "playoff";
    if (l.division === "l1" && rank > n - (rules.relegated ?? 2)) return "down";
    return null;
  };
  const excluded = new Set(
    (members ?? []).filter((m) => m.status === "excluded").map((m) => m.profile_id),
  );
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <Link
        href={`/competitions/ligues?saison=${l.seasons.slug}`}
        className="text-sm font-semibold text-bordeaux hover:underline"
      >
        ← {t("title")} · {l.seasons.name}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {t(`division.${l.division}`)} · {t(`cadence.${l.cadence}`)}{" "}
        {l.seasons.is_demo ? <DemoBadge /> : null}
      </h1>
      <p className="mt-3 text-lg text-stone">
        <span className="tabular">
          {l.base_minutes} min + {l.increment_seconds} s
        </span>{" "}
        · {t(`format.${l.format}`)}
        {l.rounds_count ? ` · ${t("rounds", { n: l.rounds_count })}` : ""} ·{" "}
        {tr(l.schedule_note, locale)}
      </p>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("standings")}</h2>
        {standings?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem]">
              <thead>
                <tr className="border-b border-line text-left text-sm text-stone">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">{t("player")}</th>
                  <th className="py-2 pr-2 text-right">{t("pts")}</th>
                  <th className="py-2 pr-2 text-right">SB</th>
                  <th className="py-2 text-right">{t("games")}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => {
                  const z = zone(Number(s.rank));
                  return (
                    <tr key={s.player_id} className="border-b border-line">
                      <td className="tabular py-2 pr-2">{s.rank}</td>
                      <td className="py-2 pr-2">
                        <Link
                          href={`/joueurs/${s.player_id}`}
                          className="font-semibold hover:text-bordeaux"
                        >
                          {s.display_name}
                        </Link>
                        {l.champion_id === s.player_id ? (
                          <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-ink">
                            {t("champion")}
                          </span>
                        ) : null}
                        {z ? (
                          <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-xs font-semibold">
                            {t(`zone.${z}`)}
                          </span>
                        ) : null}
                        {excluded.has(s.player_id!) ? (
                          <span className="ml-2 text-xs font-semibold text-bordeaux">
                            {t("excluded")}
                          </span>
                        ) : null}
                        {s.club ? <span className="block text-sm text-stone">{s.club}</span> : null}
                      </td>
                      <td className="tabular py-2 pr-2 text-right font-semibold">
                        {Number(s.points)}
                      </td>
                      <td className="tabular py-2 pr-2 text-right">{Number(s.sonneborn_berger)}</td>
                      <td className="tabular py-2 text-right">{s.games}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : members?.length ? (
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <li key={m.profile_id} className="rounded-md border border-line px-3 py-2">
                <span className="tabular mr-2 text-stone">{m.seed}</span>
                {m.display_name}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-stone">{t("noMembers")}</p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("matchdays")}</h2>
        {days?.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {days.map((d) => (
              <li key={d.number} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-semibold">{t("matchday", { n: d.number })}</span>
                <span className="text-sm text-stone">
                  {d.scheduled_on ? formatDate(d.scheduled_on, locale) : <Tbc />}
                  {d.rounds ? ` · ${t("roundsRange", { r: d.rounds })}` : ""}
                </span>
                {d.tournaments ? (
                  <Link
                    href={`/competitions/${d.tournaments.slug}`}
                    className="ml-auto font-semibold text-bordeaux hover:underline"
                  >
                    {d.tournaments.name} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-stone">
            {t("calendarTbc")} <Tbc />
          </p>
        )}
      </section>
    </div>
  );
}
