import "server-only";
import { validateComposition } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { loadTeamState } from "@/lib/teams";
import { lichessCanCreate } from "@/lib/lichess";
import { TeamsManager } from "@/components/admin/teams-manager";
import { OnlinePanel } from "@/components/admin/online-panel";
import { ScoresheetPanel } from "@/components/admin/scoresheet-panel";

type Db = Awaited<ReturnType<typeof createClient>>;

const ageOf = (birth: string | null) =>
  birth ? Math.floor((Date.now() - Date.parse(birth)) / (365.25 * 24 * 3600 * 1000)) : null;

/** Onglet « Équipes » : compositions, rondes, résultats par échiquier, classement. */
export async function teamsBody(supabase: Db, tournamentId: string) {
  const st = await loadTeamState(supabase, tournamentId);
  const { data: regs } = await supabase
    .from("registrations")
    .select("player_id, profiles!registrations_player_id_fkey(first_name, last_name)")
    .eq("tournament_id", tournamentId)
    .not("status", "in", "(cancelled,refused)");
  const name = (p: { first_name: string; last_name: string } | null | undefined) =>
    p ? `${p.first_name} ${p.last_name}` : "?";
  const inTeam = new Set(st.teams.flatMap((x) => x.team_members.map((m) => m.profile_id)));
  const cond = ((st.tournament?.conditions ?? {}) as { team?: Record<string, number> }).team ?? {};
  const teamName = new Map(st.teams.map((x) => [x.id, x.name]));
  return (
    <TeamsManager
      tournamentId={tournamentId}
      teams={st.teams.map((x) => ({
        id: x.id,
        name: x.name,
        warnings: validateComposition(
          x.team_members.map((m) => ({
            isSubstitute: m.is_substitute,
            sex: (m.profiles?.sex ?? null) as "M" | "F" | null,
            age: ageOf(m.profiles?.birth_date ?? null),
          })),
          {
            teamSize: st.size,
            maxSubstitutes: cond.max_substitutes ?? 1,
            minWomen: cond.min_women,
            minYouth: cond.min_youth,
            youthMaxAge: cond.youth_max_age,
          },
        ),
        members: x.team_members.map((m) => ({
          id: m.id,
          profileId: m.profile_id,
          name: name(m.profiles),
          board: m.board_order,
          sub: m.is_substitute,
        })),
      }))}
      available={(regs ?? [])
        .filter((r) => !inTeam.has(r.player_id))
        .map((r) => ({ id: r.player_id, name: name(r.profiles) }))}
      matches={st.matches.map((m, i) => {
        const input = st.inputs[i]!;
        let score: [number, number] | null = null;
        if (m.away_team_id) {
          const done = input.boards.every((b) => b.result);
          if (done) {
            let h = 0;
            let a = 0;
            for (const b of input.boards) {
              const [w, bl] =
                b.result === "1-0" || b.result === "+-"
                  ? [1, 0]
                  : b.result === "0-1" || b.result === "-+"
                    ? [0, 1]
                    : b.result === "0-0"
                      ? [0, 0]
                      : [0.5, 0.5];
              if (b.homeIsWhite) {
                h += w;
                a += bl;
              } else {
                h += bl;
                a += w;
              }
            }
            score = [h, a];
          }
        }
        return {
          id: m.id,
          round: m.round_number,
          table: m.table_number,
          home: m.home_team_id,
          away: m.away_team_id,
          homeName: teamName.get(m.home_team_id) ?? "?",
          awayName: m.away_team_id ? (teamName.get(m.away_team_id) ?? "?") : null,
          published: m.published,
          score,
          boards: [...m.board_results]
            .sort((a, b) => a.board - b.board)
            .map((b) => ({
              id: b.id,
              board: b.board,
              homeIsWhite: b.home_is_white,
              whiteId: b.white_id,
              blackId: b.black_id,
              result: b.result,
            })),
        };
      })}
      standings={st.standings.map((s) => ({
        rank: s.rank,
        teamId: s.teamId,
        name: teamName.get(s.teamId) ?? "?",
        mp: s.matchPoints,
        gp: s.gamePoints,
      }))}
    />
  );
}

/** Onglet « En ligne » : tournoi Lichess lié, création, import des résultats, comptes liés. */
export async function onlineBody(
  supabase: Db,
  tn: {
    id: string;
    lichess_kind: string | null;
    lichess_id: string | null;
    lichess_imported_at: string | null;
  },
) {
  const { data: regs } = await supabase
    .from("registrations")
    .select("player_id, profiles!registrations_player_id_fkey(first_name, last_name)")
    .eq("tournament_id", tn.id)
    .not("status", "in", "(cancelled,refused)");
  const ids = (regs ?? []).map((r) => r.player_id);
  // Lecture système limitée aux inscrits du tournoi (la page exige déjà le rôle de staff).
  const { data: accounts } = ids.length
    ? await createAdminClient()
        .from("lichess_accounts")
        .select("profile_id, username")
        .in("profile_id", ids)
    : { data: [] };
  const user = new Map((accounts ?? []).map((a) => [a.profile_id, a.username]));
  return (
    <OnlinePanel
      tournamentId={tn.id}
      kind={tn.lichess_kind}
      lichessId={tn.lichess_id}
      importedAt={tn.lichess_imported_at}
      canCreate={lichessCanCreate()}
      players={(regs ?? []).map((r) => ({
        name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "?",
        username: user.get(r.player_id) ?? null,
      }))}
    />
  );
}

/** Onglet « Feuilles de notation » : parties appariées sans partie saisie. */
export async function scoresheetBody(supabase: Db, tournamentId: string) {
  const [{ data: pairings }, { data: games }] = await Promise.all([
    supabase
      .from("public_pairings")
      .select("id, round_number, board, white_name, black_name, black_id")
      .eq("tournament_id", tournamentId)
      .not("black_id", "is", null)
      .order("round_number")
      .order("board"),
    supabase.from("games").select("pairing_id").eq("tournament_id", tournamentId),
  ]);
  const done = new Set((games ?? []).map((g) => g.pairing_id));
  const list = (pairings ?? [])
    .filter((p) => !done.has(p.id))
    .map((p) => ({
      id: p.id!,
      label: `R${p.round_number} · ${p.board} · ${p.white_name} – ${p.black_name}`,
    }));
  return <ScoresheetPanel tournamentId={tournamentId} pairings={list} />;
}
