import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { teamStandings, type ResultCode, type TeamScoring } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentBySlug } from "@/lib/data/tournaments";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  return t ? { title: `${t.name} — équipes` } : {};
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTournamentBySlug(slug);
  if (!t || t.pairing_system !== "team_swiss") notFound();
  const tt = await getTranslations("teamsPublic");
  const supabase = await createClient();
  const [{ data: teams }, { data: members }, { data: matches }] = await Promise.all([
    supabase.from("teams").select("id, name, seed").eq("tournament_id", t.id).order("seed"),
    supabase.from("public_team_members").select("*").eq("tournament_id", t.id).order("board_order"),
    supabase
      .from("team_matches")
      .select("id, round_number, table_number, home_team_id, away_team_id")
      .eq("tournament_id", t.id)
      .eq("published", true)
      .order("round_number")
      .order("table_number"),
  ]);
  const ids = (matches ?? []).map((m) => m.id);
  const { data: boards } = ids.length
    ? await supabase
        .from("public_board_results")
        .select("*")
        .in("team_match_id", ids)
        .order("board")
    : { data: [] };
  const name = new Map((teams ?? []).map((x) => [x.id, x.name]));
  const standings = teamStandings(
    (teams ?? []).map((x) => ({ id: x.id, seed: x.seed })),
    (matches ?? []).map((m) => ({
      round: m.round_number,
      home: m.home_team_id,
      away: m.away_team_id,
      boards: (boards ?? [])
        .filter((b) => b.team_match_id === m.id)
        .map((b) => ({
          homeIsWhite: !!b.home_is_white,
          result: (b.result ?? null) as ResultCode | null,
        })),
    })),
    (t.team_scoring ?? "match_points") as TeamScoring,
    t.team_size ?? 4,
  );
  const rounds = [...new Set((matches ?? []).map((m) => m.round_number))];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <Link
        href={`/competitions/${t.slug}`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← {t.name}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">{tt("title")}</h1>
      <p className="mt-2 text-stone">
        {tt(`scoring.${t.team_scoring ?? "match_points"}`)} ·{" "}
        {tt("boards", { n: t.team_size ?? 4 })}
      </p>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{tt("standings")}</h2>
        <table className="mt-3 w-full">
          <thead>
            <tr className="border-b border-line text-left text-sm text-stone">
              <th className="py-2">#</th>
              <th className="py-2">{tt("team")}</th>
              <th className="py-2 text-right">{tt("mp")}</th>
              <th className="py-2 text-right">{tt("gp")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.teamId} className="border-b border-line">
                <td className="tabular py-2">{s.rank}</td>
                <td className="py-2 font-semibold">{name.get(s.teamId)}</td>
                <td className="tabular py-2 text-right">{s.matchPoints}</td>
                <td className="tabular py-2 text-right">{s.gamePoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {(teams ?? []).map((team) => (
          <div key={team.id} className="rounded-lg border border-line p-4">
            <h3 className="font-semibold">{team.name}</h3>
            <ol className="mt-2 text-sm">
              {(members ?? [])
                .filter((m) => m.team_id === team.id)
                .map((m) => (
                  <li key={m.profile_id}>
                    <span className="tabular mr-2 text-stone">
                      {m.is_substitute ? "R" : m.board_order}
                    </span>
                    {m.display_name}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>
      {rounds.map((r) => (
        <section key={r} className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{tt("round", { n: r })}</h2>
          <ul className="mt-3 space-y-3">
            {(matches ?? [])
              .filter((m) => m.round_number === r)
              .map((m) => (
                <li key={m.id} className="rounded-md border border-line p-3">
                  <p className="font-semibold">
                    {name.get(m.home_team_id)} –{" "}
                    {m.away_team_id ? name.get(m.away_team_id) : tt("bye")}
                  </p>
                  <ol className="mt-1 text-sm">
                    {(boards ?? [])
                      .filter((b) => b.team_match_id === m.id)
                      .map((b) => (
                        <li key={b.board} className="flex gap-2">
                          <span className="tabular w-5 text-stone">{b.board}</span>
                          <span className="min-w-0 flex-1">
                            {b.white_name ?? "—"} – {b.black_name ?? "—"}
                          </span>
                          <span className="tabular">
                            {b.result === "1/2-1/2" ? "½-½" : (b.result ?? "")}
                          </span>
                        </li>
                      ))}
                  </ol>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
