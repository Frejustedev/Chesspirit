import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getSeasons, pickSeason, type LeagueRules } from "@/lib/data/leagues";
import { seasonMovements } from "@/lib/leagues/template";
import { SeasonPicker } from "@/components/competitions/season-picker";
import { DecideButtons } from "@/components/competitions/league-actions";
import {
  AddStageForm,
  LeagueRowActions,
  MemberAdd,
  MemberStatus,
  NewSeasonForm,
  SeasonSettings,
  StageRow,
} from "@/components/admin/league-admin";

export const metadata: Metadata = {
  title: "Administration — ligues et Tour",
  robots: { index: false },
};

export default async function AdminLeagues({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saison?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/ligues");
  if (!admin) redirect({ href: "/admin", locale });
  const { saison } = await searchParams;
  const t = await getTranslations("adminLeagues");
  const tl = await getTranslations("leagues");
  const tt = await getTranslations("tour");
  const [season, seasons] = await Promise.all([pickSeason(saison), getSeasons()]);
  const supabase = await createClient();
  const [{ data: leagues }, { data: stages }, { data: tournaments }] = await Promise.all([
    season
      ? supabase
          .from("leagues")
          .select(
            "*, league_matchdays(number, tournament_id), league_members(profile_id, status, seed, unjustified_forfeits, profiles(first_name, last_name))",
          )
          .eq("season_id", season.id)
          .order("division")
      : Promise.resolve({ data: [] }),
    season
      ? supabase
          .from("tour_stages")
          .select("*, tournaments(name, status)")
          .eq("season_id", season.id)
          .order("number")
      : Promise.resolve({ data: [] }),
    supabase
      .from("tournaments")
      .select("id, name, starts_at")
      .order("starts_at", { ascending: false })
      .limit(200),
  ]);
  const leagueIds = (leagues ?? []).map((l) => l.id);
  const [{ data: standings }, { data: postponements }] = await Promise.all([
    leagueIds.length
      ? supabase
          .from("league_standings")
          .select("league_id, player_id, rank, display_name")
          .in("league_id", leagueIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("league_postponements")
      .select(
        "id, status, opponent_agreed, reason, proposed_date, pairings(tournament_id, tournaments(name, league_id))",
      )
      .eq("status", "pending"),
  ]);
  const rules = (season?.league_rules ?? {}) as LeagueRules;
  const nameOf = (id: string | null) =>
    (standings ?? []).find((s) => s.player_id === id)?.display_name ?? "—";
  const order = { l1: 0, l2: 1, amateur: 2 } as Record<string, number>;
  const sorted = [...(leagues ?? [])].sort(
    (a, b) => order[a.division]! - order[b.division]! || a.cadence.localeCompare(b.cadence),
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <div className="mt-6 flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">
          <SeasonPicker
            base="/admin/ligues"
            seasons={seasons}
            current={season?.slug ?? ""}
            label={tl("seasons")}
          />
        </div>
        <NewSeasonForm />
      </div>
      {season ? (
        <>
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">
              {season.name} · {formatDate(season.starts_on, locale)} →{" "}
              {formatDate(season.ends_on, locale)}
            </h2>
            <SeasonSettings
              key={season.id}
              season={{
                id: season.id,
                status: season.status,
                licenseFee: season.license_fee_xof,
                bestResults: season.tour_best_results,
                mastersQualified: season.masters_qualified,
                mastersInvited: season.masters_invited,
                rules: JSON.stringify(season.league_rules, null, 2),
              }}
            />
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("leagues")}</h2>
            <ul className="mt-3 space-y-3">
              {sorted.map((l) => (
                <li key={l.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/competitions/ligues/${l.slug}`}
                      className="font-semibold hover:text-accent"
                    >
                      {tl(`division.${l.division}`)} · {tl(`cadence.${l.cadence}`)}
                    </Link>
                    <span className="text-sm text-stone">
                      {t("summary", {
                        members: l.league_members.length,
                        days: l.league_matchdays.length,
                      })}{" "}
                      · {t(`leagueStatus.${l.status}`)}
                      {l.champion_id ? ` · ${tl("champion")} : ${nameOf(l.champion_id)}` : ""}
                    </span>
                  </div>
                  <LeagueRowActions leagueId={l.id} />
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                      {t("members")}
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {[...l.league_members]
                        .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
                        .map((m) => (
                          <li key={m.profile_id} className="flex flex-wrap items-center gap-2">
                            <span className="tabular w-6 text-stone">{m.seed}</span>
                            <Link
                              href={`/admin/utilisateurs/${m.profile_id}`}
                              className="min-w-0 flex-1 underline"
                            >
                              {m.profiles?.first_name} {m.profiles?.last_name}
                            </Link>
                            {m.unjustified_forfeits ? (
                              <span className="text-accent">
                                {t("forfeits", { n: m.unjustified_forfeits })}
                              </span>
                            ) : null}
                            <MemberStatus
                              leagueId={l.id}
                              profileId={m.profile_id}
                              status={m.status}
                            />
                          </li>
                        ))}
                    </ul>
                    <MemberAdd leagueId={l.id} />
                  </details>
                </li>
              ))}
            </ul>
            <LeagueRowActions seasonId={season.id} />
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("movements")}</h2>
            <p className="mt-1 text-sm text-stone">{t("movementsHelp")}</p>
            <ul className="mt-3 space-y-2">
              {(["classical", "rapid", "blitz"] as const).map((c) => {
                const l1 = sorted.find((l) => l.division === "l1" && l.cadence === c);
                const l2 = sorted.find((l) => l.division === "l2" && l.cadence === c);
                const s1 = (standings ?? []).filter((s) => s.league_id === l1?.id);
                const s2 = (standings ?? []).filter((s) => s.league_id === l2?.id);
                if (!s1.length && !s2.length)
                  return (
                    <li key={c} className="text-sm text-stone">
                      {tl(`cadence.${c}`)} : {t("noStandings")}
                    </li>
                  );
                const m = seasonMovements(
                  s1.map((s) => ({ player_id: s.player_id!, rank: Number(s.rank) })),
                  s2.map((s) => ({ player_id: s.player_id!, rank: Number(s.rank) })),
                  rules,
                );
                return (
                  <li key={c} className="text-sm">
                    <span className="font-semibold">{tl(`cadence.${c}`)}</span> — {t("up")} :{" "}
                    {m.promoted.map(nameOf).join(", ") || "—"} · {t("down")} :{" "}
                    {m.relegated.map(nameOf).join(", ") || "—"} · {t("playoff")} :{" "}
                    {m.playoff.map(nameOf).join(" – ")}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{t("postponements")}</h2>
            <ul className="mt-3 space-y-2">
              {(postponements ?? [])
                .filter((p) => leagueIds.includes(p.pairings?.tournaments?.league_id ?? ""))
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      {p.pairings?.tournaments?.name} · {p.reason}
                      {p.proposed_date ? ` · ${formatDate(p.proposed_date, locale)}` : ""}
                    </span>
                    <DecideButtons id={p.id} agreed={p.opponent_agreed} />
                  </li>
                ))}
              {!(postponements ?? []).some((p) =>
                leagueIds.includes(p.pairings?.tournaments?.league_id ?? ""),
              ) ? (
                <li className="text-sm text-stone">{t("noPostponements")}</li>
              ) : null}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">{tt("title")}</h2>
            <ul className="mt-3 space-y-2">
              {(stages ?? []).map((s) => (
                <StageRow
                  key={s.id}
                  stage={{
                    id: s.id,
                    number: s.number,
                    name: s.name,
                    kind: s.kind,
                    coefficient: Number(s.coefficient),
                    tournamentId: s.tournament_id,
                    status: s.status,
                  }}
                  tournaments={(tournaments ?? []).map((x) => ({ id: x.id, name: x.name }))}
                />
              ))}
            </ul>
            <AddStageForm
              seasonId={season.id}
              tournaments={(tournaments ?? []).map((x) => ({ id: x.id, name: x.name }))}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
