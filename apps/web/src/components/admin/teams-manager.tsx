"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import {
  addTeamMemberAction,
  createTeamAction,
  deleteTeamAction,
  generateTeamRoundAction,
  orderBoardsByRatingAction,
  publishTeamRoundAction,
  removeTeamMemberAction,
  setBoardPlayerAction,
  setBoardResultAction,
} from "@/app/actions/teams";

export type TeamView = {
  id: string;
  name: string;
  warnings: string[];
  members: { id: string; profileId: string; name: string; board: number; sub: boolean }[];
};
export type MatchView = {
  id: string;
  round: number;
  table: number;
  home: string;
  away: string | null;
  homeName: string;
  awayName: string | null;
  published: boolean;
  score: [number, number] | null;
  boards: {
    id: string;
    board: number;
    homeIsWhite: boolean;
    whiteId: string | null;
    blackId: string | null;
    result: string | null;
  }[];
};

const RESULTS = ["1-0", "0-1", "1/2-1/2", "+-", "-+", "=-=", "0-0"];

export function TeamsManager({
  tournamentId,
  teams,
  available,
  matches,
  standings,
}: {
  tournamentId: string;
  teams: TeamView[];
  available: { id: string; name: string }[];
  matches: MatchView[];
  standings: { rank: number; teamId: string; name: string; mp: number; gp: number }[];
}) {
  const t = useTranslations("teamsAdmin");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (!r.ok) setMsg(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.generic"));
      router.refresh();
    });
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const teamMembers = (teamId: string) => teams.find((x) => x.id === teamId)?.members ?? [];

  return (
    <div className="space-y-10">
      {msg ? (
        <p role="alert" className="rounded bg-bordeaux-soft px-3 py-2 font-semibold text-rose">
          {msg}
        </p>
      ) : null}
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("teams")}</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await createTeamAction(tournamentId, newTeam);
              if (r.ok) setNewTeam("");
              return r;
            });
          }}
        >
          <label htmlFor="new-team" className="sr-only">
            {t("teamName")}
          </label>
          <input
            id="new-team"
            value={newTeam}
            placeholder={t("teamName")}
            onChange={(e) => setNewTeam(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3"
          />
          <Button type="submit" disabled={pending || newTeam.trim().length < 2}>
            {t("addTeam")}
          </Button>
        </form>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 font-semibold">{team.name}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => orderBoardsByRatingAction(team.id))}
                  className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold"
                >
                  {t("orderByRating")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(t("deleteConfirm"))) run(() => deleteTeamAction(team.id));
                  }}
                  className="min-h-10 px-2 text-sm font-semibold text-accent"
                >
                  {t("delete")}
                </button>
              </div>
              {team.warnings.length ? (
                <p className="mt-1 text-sm font-semibold text-accent">
                  {team.warnings.map((w) => t(`warnings.${w}`)).join(" · ")}
                </p>
              ) : null}
              <ol className="mt-2 space-y-1 text-sm">
                {[...team.members]
                  .sort((a, b) => a.board - b.board)
                  .map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="tabular w-6 text-stone">{m.sub ? "R" : m.board}</span>
                      <span className="min-w-0 flex-1">{m.name}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeTeamMemberAction(m.id))}
                        className="min-h-10 px-2 text-accent"
                        aria-label={t("removeMember", { name: m.name })}
                      >
                        ×
                      </button>
                    </li>
                  ))}
              </ol>
              <AddMember
                teamId={team.id}
                available={available}
                disabled={pending}
                onAdd={(pid, sub) => run(() => addTeamMemberAction(team.id, pid, sub))}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold">{t("rounds")}</h2>
          <Button
            disabled={pending}
            onClick={() => run(() => generateTeamRoundAction(tournamentId))}
          >
            {t("generate")}
          </Button>
        </div>
        {rounds.map((r) => {
          const ms = matches.filter((m) => m.round === r);
          const published = ms.every((m) => m.published);
          return (
            <div key={r} className="mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-xl font-semibold">{t("round", { n: r })}</h3>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => publishTeamRoundAction(tournamentId, r, !published))}
                  className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold"
                >
                  {published ? t("unpublish") : t("publish")}
                </button>
              </div>
              <ul className="mt-2 space-y-3">
                {ms.map((m) => (
                  <li key={m.id} className="rounded-md border border-line p-3">
                    <p className="font-semibold">
                      {t("table", { n: m.table })} · {m.homeName} – {m.awayName ?? t("bye")}
                      {m.score ? (
                        <span className="tabular ml-2">
                          {m.score[0]} – {m.score[1]}
                        </span>
                      ) : null}
                    </p>
                    {m.away ? (
                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {m.boards.map((b) => {
                            const homeSide = b.homeIsWhite ? "white" : "black";
                            const awaySide = b.homeIsWhite ? "black" : "white";
                            const pick = (side: "white" | "black", team: string) => (
                              <select
                                aria-label={t("boardPlayer", { n: b.board, side: t(side) })}
                                defaultValue={(side === "white" ? b.whiteId : b.blackId) ?? ""}
                                disabled={pending}
                                onChange={(e) =>
                                  run(() =>
                                    setBoardPlayerAction(b.id, side, e.target.value || null),
                                  )
                                }
                                className="min-h-10 w-full max-w-48 rounded-md border border-line bg-field px-1"
                              >
                                <option value="">—</option>
                                {teamMembers(team).map((x) => (
                                  <option key={x.profileId} value={x.profileId}>
                                    {x.name}
                                  </option>
                                ))}
                              </select>
                            );
                            return (
                              <tr key={b.id} className="border-t border-line">
                                <td className="tabular w-6 py-1">{b.board}</td>
                                <td className="py-1 pr-1">{pick(homeSide, m.home)}</td>
                                <td className="py-1 pr-1">{pick(awaySide, m.away!)}</td>
                                <td className="py-1">
                                  <select
                                    aria-label={t("boardResult", { n: b.board })}
                                    defaultValue={b.result ?? ""}
                                    disabled={pending}
                                    onChange={(e) =>
                                      run(() => setBoardResultAction(b.id, e.target.value || null))
                                    }
                                    className="min-h-10 rounded-md border border-line bg-field px-1"
                                  >
                                    <option value="">…</option>
                                    {RESULTS.map((x) => (
                                      <option key={x} value={x}>
                                        {x === "1/2-1/2" ? "½-½" : x}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{t("standings")}</h2>
        <table className="mt-3 w-full">
          <thead>
            <tr className="border-b border-line text-left text-sm text-stone">
              <th className="py-2">#</th>
              <th className="py-2">{t("team")}</th>
              <th className="py-2 text-right">{t("mp")}</th>
              <th className="py-2 text-right">{t("gp")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.teamId} className="border-b border-line">
                <td className="tabular py-2">{s.rank}</td>
                <td className="py-2 font-semibold">{s.name}</td>
                <td className="tabular py-2 text-right">{s.mp}</td>
                <td className="tabular py-2 text-right">{s.gp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AddMember({
  teamId,
  available,
  disabled,
  onAdd,
}: {
  teamId: string;
  available: { id: string; name: string }[];
  disabled: boolean;
  onAdd: (profileId: string, sub: boolean) => void;
}) {
  const t = useTranslations("teamsAdmin");
  const [pid, setPid] = useState("");
  const [sub, setSub] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor={`am-${teamId}`} className="sr-only">
        {t("player")}
      </label>
      <select
        id={`am-${teamId}`}
        value={pid}
        onChange={(e) => setPid(e.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-field px-2 text-sm"
      >
        <option value="">{t("choosePlayer")}</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={sub}
          onChange={(e) => setSub(e.target.checked)}
          className="size-5"
        />
        {t("substitute")}
      </label>
      <Button
        className="min-h-10 px-3 text-sm"
        disabled={disabled || !pid}
        onClick={() => {
          onAdd(pid, sub);
          setPid("");
        }}
      >
        {t("add")}
      </Button>
    </div>
  );
}
