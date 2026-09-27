"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Select } from "@/components/ui/form";
import { IconPrint, IconEdit } from "@/components/icons";
import {
  addTiebreakGameAction,
  closeTournamentAction,
  deleteLastRoundAction,
  editPairingAction,
  generateRoundAction,
  publishRoundAction,
  setParticipationAction,
  setResultAction,
  swapColorsAction,
} from "@/app/actions/rounds";

export type RMParticipant = {
  registrationId: string;
  playerId: string;
  startNo: number;
  name: string;
  rating: number;
  checkedIn: boolean;
  withdrawn: boolean;
  byeRequests: Record<string, "half" | "zero">;
};
export type RMRound = {
  id: string;
  number: number;
  status: string;
  published: boolean;
  engine: string | null;
};
export type RMPairing = {
  id: string;
  roundId: string;
  board: number;
  white: string;
  black: string | null;
  result: string | null;
  byeType: string | null;
  stage: string;
  manual: boolean;
};

const QUICK = [
  { r: "1-0", label: "1–0" },
  { r: "1/2-1/2", label: "½–½" },
  { r: "0-1", label: "0–1" },
] as const;
const MORE = ["+-", "-+", "=-=", "0-0"] as const;

export function RoundsManager({
  tournamentId,
  slug,
  system,
  roundsCount,
  participants,
  rounds,
  pairings,
  canClose,
}: {
  tournamentId: string;
  slug: string;
  system: string;
  roundsCount: number | null;
  participants: RMParticipant[];
  rounds: RMRound[];
  pairings: RMPairing[];
  canClose: boolean;
}) {
  const t = useTranslations("rounds");
  const ts = useTranslations("tournament");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(rounds.at(-1)?.id ?? null);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState(participants.some((p) => p.checkedIn));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const byId = new Map(participants.map((p) => [p.playerId, p]));
  const round = rounds.find((r) => r.id === selected) ?? rounds.at(-1) ?? null;
  const boards = pairings
    .filter((p) => p.roundId === round?.id)
    .sort((a, b) => (a.board || 999) - (b.board || 999) || a.stage.localeCompare(b.stage));
  const missing = boards.filter((b) => b.black && !b.result).length;
  const nextNumber = (rounds.at(-1)?.number ?? 0) + 1;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok)
        setMsg({
          kind: "err",
          text: te.has(r.error!)
            ? te(r.error!)
            : t.has(`err.${r.error}`)
              ? t(`err.${r.error}`)
              : r.error!,
        });
      else {
        setMsg(okText ? { kind: "ok", text: okText } : null);
        router.refresh();
      }
    });

  const label = (id: string | null) => {
    if (!id) return t("bye");
    const p = byId.get(id);
    return p ? `${p.name}` : "?";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-cream/50 p-4">
        <div className="mr-auto">
          <p className="font-display text-xl font-semibold">{ts(`system.${system}`)}</p>
          <p className="text-sm text-stone">
            {t("summary", {
              players: participants.filter((p) => !p.withdrawn).length,
              rounds: rounds.length,
              total: roundsCount ?? "?",
            })}
          </p>
        </div>
        <Checkbox
          id="only-checked"
          checked={onlyCheckedIn}
          onChange={(e) => setOnlyCheckedIn(e.target.checked)}
          label={t("onlyCheckedIn")}
        />
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await generateRoundAction(tournamentId, onlyCheckedIn);
              if (!r.ok)
                return setMsg({
                  kind: "err",
                  text: t.has(`err.${r.error}`) ? t(`err.${r.error}`) : r.error,
                });
              setMsg({
                kind: r.data!.engine === "fallback" ? "err" : "ok",
                text:
                  r.data!.engine === "fallback"
                    ? t("fallbackWarning", { round: r.data!.round })
                    : t("generated", { round: r.data!.round }),
              });
              setSelected(null);
              router.refresh();
            })
          }
        >
          {t("generate", { n: nextNumber })}
        </Button>
      </div>

      {msg ? (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className={`rounded px-3 py-2 text-sm font-semibold ${msg.kind === "err" ? "bg-bordeaux-soft text-bordeaux" : "bg-success/15 text-success"}`}
        >
          {msg.text}
        </p>
      ) : null}

      {rounds.length ? (
        <nav aria-label={t("roundsNav")} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {rounds.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-current={round?.id === r.id ? "true" : undefined}
                  className={`min-h-11 min-w-11 rounded-full border px-4 font-semibold ${round?.id === r.id ? "border-bordeaux bg-bordeaux text-cream" : "border-line hover:border-bordeaux"}`}
                >
                  R{r.number}
                  {r.status === "finished" ? " ✓" : ""}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p className="text-stone">{t("noRounds")}</p>
      )}

      {round ? (
        <section aria-labelledby="round-title">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="round-title" className="mr-auto font-display text-2xl font-semibold">
              {t("round", { n: round.number })}{" "}
              <span
                className={`ml-2 align-middle text-xs font-semibold uppercase tracking-wide ${round.engine === "fallback" ? "text-bordeaux" : "text-stone"}`}
              >
                {round.engine ? t(`engine.${round.engine}`) : ""}
              </span>
            </h2>
            <span className="text-sm text-stone">
              {missing ? t("missing", { n: missing }) : t("complete")}
            </span>
            <Button
              variant={round.published ? "secondary" : "primary"}
              className="min-h-11 px-4 text-sm"
              disabled={pending}
              onClick={() => run(() => publishRoundAction(round.id, !round.published))}
            >
              {round.published ? t("unpublish") : t("publish")}
            </Button>
            <Link
              href={`/admin/tournois/${tournamentId}/imprimer?ronde=${round.number}&type=appariements`}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold hover:bg-cream"
              target="_blank"
            >
              <IconPrint className="size-4" /> {t("print")}
            </Link>
          </div>
          <ol className="mt-4 space-y-2">
            {boards.map((b) => (
              <li
                key={b.id}
                className={`rounded-lg border p-3 ${b.result || !b.black ? "border-line bg-paper" : "border-gold bg-gold-soft/20"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="tabular mt-0.5 w-8 shrink-0 text-center font-display text-xl text-gold-deep">
                    {b.board || "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    {b.stage !== "main" ? (
                      <p className="text-xs font-semibold uppercase text-bordeaux">
                        {t(`stage.${b.stage}`)}
                      </p>
                    ) : null}
                    <p className="truncate font-semibold">
                      <span
                        aria-hidden
                        className="mr-1 inline-block size-3 rounded-sm border border-ink bg-paper align-middle"
                      />{" "}
                      {label(b.white)}
                      <span className="tabular ml-1 text-xs text-stone">
                        {byId.get(b.white)?.rating || ""}
                      </span>
                    </p>
                    <p className="truncate font-semibold">
                      <span
                        aria-hidden
                        className="mr-1 inline-block size-3 rounded-sm bg-ink align-middle"
                      />{" "}
                      {b.black ? label(b.black) : t(`byeKind.${b.byeType ?? "full"}`)}
                      <span className="tabular ml-1 text-xs text-stone">
                        {b.black ? byId.get(b.black)?.rating || "" : ""}
                      </span>
                    </p>
                    {b.manual ? <p className="text-xs text-stone">{t("manual")}</p> : null}
                  </div>
                  {b.black ? (
                    <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-cream"
                      aria-label={t("edit")}
                      onClick={() => setEditing(editing === b.id ? null : b.id)}
                    >
                      <IconEdit className="size-5" />
                    </button>
                  ) : null}
                </div>
                {b.black ? (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={t("resultFor", { board: b.board })}
                  >
                    {QUICK.map((q) => (
                      <button
                        key={q.r}
                        type="button"
                        disabled={pending}
                        aria-pressed={b.result === q.r}
                        onClick={() =>
                          run(() => setResultAction(b.id, b.result === q.r ? null : q.r))
                        }
                        className={`tabular min-h-11 min-w-16 flex-1 rounded-md border text-lg font-semibold sm:flex-none ${b.result === q.r ? "border-ink bg-ink text-cream" : "border-line bg-paper hover:border-ink"}`}
                      >
                        {q.label}
                      </button>
                    ))}
                    <Select
                      aria-label={t("otherResults")}
                      value={MORE.includes(b.result as never) ? b.result! : ""}
                      onChange={(e) => run(() => setResultAction(b.id, e.target.value || null))}
                      className="!mt-0 !min-h-11 !w-auto text-sm"
                    >
                      <option value="">{t("other")}</option>
                      {MORE.map((m) => (
                        <option key={m} value={m}>
                          {t(`result.${m}`)}
                        </option>
                      ))}
                    </Select>
                    {system === "knockout" &&
                    b.result &&
                    ["1/2-1/2", "=-="].includes(b.result) &&
                    b.stage !== "armageddon" ? (
                      <Button
                        variant="secondary"
                        className="min-h-11 px-3 text-sm"
                        onClick={() => run(() => addTiebreakGameAction(b.id))}
                      >
                        {t("tiebreak")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {editing === b.id ? (
                  <EditPairing
                    participants={participants}
                    white={b.white}
                    black={b.black}
                    onSwap={() => run(() => swapColorsAction(b.id))}
                    onSave={(w, bl) => {
                      setEditing(null);
                      run(() => editPairingAction(b.id, w, bl));
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ol>
          {round.id === rounds.at(-1)?.id ? (
            <button
              type="button"
              className="mt-4 min-h-11 text-sm font-semibold text-bordeaux hover:underline"
              onClick={() =>
                confirm(t("deleteConfirm")) && run(() => deleteLastRoundAction(round.id))
              }
            >
              {t("deleteRound")}
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-line">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between px-4 font-semibold"
          aria-expanded={showPlayers}
          onClick={() => setShowPlayers(!showPlayers)}
        >
          {t("participants", { n: participants.length })}{" "}
          <span aria-hidden>{showPlayers ? "−" : "+"}</span>
        </button>
        {showPlayers ? (
          <ul className="divide-y divide-line border-t border-line">
            {participants.map((p) => (
              <li
                key={p.playerId}
                className={`flex flex-wrap items-center gap-2 px-4 py-2 ${p.withdrawn ? "opacity-50" : ""}`}
              >
                <span className="tabular w-8 text-stone">{p.startNo}</span>
                <span className="min-w-0 flex-1 font-medium">
                  {p.name} <span className="tabular text-xs text-stone">{p.rating || ""}</span>
                  {p.checkedIn ? <span className="ml-1 text-xs text-success">✓</span> : null}
                </span>
                <Select
                  aria-label={t("byeNext", { n: nextNumber })}
                  className="!mt-0 !min-h-10 !w-auto text-sm"
                  value={p.byeRequests[String(nextNumber)] ?? ""}
                  onChange={(e) =>
                    run(() =>
                      setParticipationAction(p.registrationId, {
                        byeRound: nextNumber,
                        byeKind: (e.target.value || null) as "half" | "zero" | null,
                      }),
                    )
                  }
                >
                  <option value="">{t("byeNone", { n: nextNumber })}</option>
                  <option value="half">{t("byeHalf")}</option>
                  <option value="zero">{t("byeZero")}</option>
                </Select>
                <button
                  type="button"
                  className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold"
                  onClick={() =>
                    run(() => setParticipationAction(p.registrationId, { withdrawn: !p.withdrawn }))
                  }
                >
                  {p.withdrawn ? t("reinstate") : t("withdraw")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/competitions/${slug}/direct`}
          className="inline-flex min-h-12 items-center rounded-full border border-ink/25 px-5 font-semibold hover:bg-cream"
          target="_blank"
        >
          {t("live")}
        </Link>
        <Link
          href={`/competitions/${slug}/direct?projection=1`}
          className="inline-flex min-h-12 items-center rounded-full border border-ink/25 px-5 font-semibold hover:bg-cream"
          target="_blank"
        >
          {t("projection")}
        </Link>
        {canClose ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              confirm(t("closeConfirm")) &&
              run(() => closeTournamentAction(tournamentId), t("closed"))
            }
          >
            {t("close")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EditPairing({
  participants,
  white,
  black,
  onSave,
  onSwap,
}: {
  participants: RMParticipant[];
  white: string;
  black: string | null;
  onSave: (w: string, b: string | null) => void;
  onSwap: () => void;
}) {
  const t = useTranslations("rounds");
  const [w, setW] = useState(white);
  const [b, setB] = useState(black ?? "");
  return (
    <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto_auto]">
      <Select
        aria-label={t("whitePlayer")}
        value={w}
        onChange={(e) => setW(e.target.value)}
        className="!mt-0"
      >
        {participants.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.startNo}. {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t("blackPlayer")}
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="!mt-0"
      >
        {participants.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.startNo}. {p.name}
          </option>
        ))}
      </Select>
      <Button variant="secondary" className="min-h-11 px-3 text-sm" onClick={onSwap}>
        {t("swap")}
      </Button>
      <Button className="min-h-11 px-3 text-sm" onClick={() => onSave(w, b || null)}>
        {t("savePairing")}
      </Button>
    </div>
  );
}
