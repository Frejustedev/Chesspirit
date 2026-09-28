"use client";

import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Chess } from "chess.js";
import { useRouter } from "@/i18n/navigation";
import { Board } from "@/components/chess/board";
import { Button, Field, Input } from "@/components/ui/form";
import {
  applyAmbassadorAction,
  castAwardVoteAction,
  claimReferralAction,
  predictAction,
  pvmFinishAction,
  pvmMasterMoveAction,
  pvmPlayPublicMoveAction,
  pvmVoteAction,
  requestMembershipAction,
} from "@/app/actions/community";

function useErr() {
  const t = useTranslations("community.errors");
  return (code: string) => (t.has(code) ? t(code) : t("generic"));
}

function Status({ msg, error }: { msg: string | null; error?: boolean }) {
  if (!msg) return null;
  return (
    <span
      role={error ? "alert" : "status"}
      className={`text-sm font-semibold ${error ? "text-accent" : "text-success"}`}
    >
      {msg}
    </span>
  );
}

export function MembershipButton({ plan, label }: { plan: "free" | "premium"; label: string }) {
  const router = useRouter();
  const err = useErr();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await requestMembershipAction(plan);
            if (!r.ok) return setMsg(err(r.error));
            if (r.data?.redirect) window.location.assign(r.data.redirect);
            else router.refresh();
          })
        }
      >
        {label}
      </Button>
      <Status msg={msg} error />
    </div>
  );
}

export function AmbassadorForm() {
  const t = useTranslations("community.ambassadors");
  const err = useErr();
  const [state, action, pending] = useActionState(applyAmbassadorAction, null);
  if (state?.ok)
    return (
      <p role="status" className="font-semibold text-success">
        {t("applied")}
      </p>
    );
  return (
    <form action={action} className="grid gap-3">
      <Field id="amb-city" label={t("city")}>
        <Input id="amb-city" name="city" required minLength={2} maxLength={80} />
      </Field>
      <div>
        <label htmlFor="amb-motivation" className="block text-sm font-semibold">
          {t("motivation")}
        </label>
        <textarea
          id="amb-motivation"
          name="motivation"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
        <Status msg={state && !state.ok ? err(state.error) : null} error />
      </div>
    </form>
  );
}

export function ReferralClaimForm() {
  const t = useTranslations("community.referral");
  const err = useErr();
  const [state, action, pending] = useActionState(claimReferralAction, null);
  if (state?.ok)
    return (
      <p role="status" className="font-semibold text-success">
        {t("claimed")}
      </p>
    );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field id="ref-code" label={t("code")}>
        <Input id="ref-code" name="code" required maxLength={12} className="uppercase" />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("claim")}
      </Button>
      <Status msg={state && !state.ok ? err(state.error) : null} error />
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const t = useTranslations("community.referral");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 break-all rounded bg-surface px-3 py-2 text-sm">{url}</code>
      <button
        type="button"
        className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-surface"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => setCopied(true));
        }}
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}

export function AwardVoteButton({
  nomineeId,
  chosen,
  label,
}: {
  nomineeId: string;
  chosen: boolean;
  label: string;
}) {
  const t = useTranslations("community.awards");
  const router = useRouter();
  const err = useErr();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (chosen)
    return (
      <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-semibold">
        {t("yourVote")}
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        aria-label={`${t("vote")} : ${label}`}
        className="min-h-10 rounded-full border border-fg px-4 text-sm font-semibold hover:bg-bordeaux-bright hover:text-cream"
        onClick={() =>
          start(async () => {
            const r = await castAwardVoteAction(nomineeId);
            if (!r.ok) return setMsg(err(r.error));
            router.refresh();
          })
        }
      >
        {t("vote")}
      </button>
      <Status msg={msg} error />
    </span>
  );
}

const RESULTS = ["1-0", "1/2-1/2", "0-1"] as const;

export function PredictButtons({
  pairingId,
  current,
  board,
}: {
  pairingId: string;
  current: string | null;
  board: number;
}) {
  const t = useTranslations("community.predictions");
  const router = useRouter();
  const err = useErr();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t("board", { n: board })}
    >
      {RESULTS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={busy}
          aria-pressed={current === r}
          className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${current === r ? "border-bordeaux bg-bordeaux text-cream" : "border-line hover:bg-surface"}`}
          onClick={() =>
            start(async () => {
              const res = await predictAction(pairingId, r);
              if (!res.ok) return setMsg(err(res.error));
              setMsg(t("saved"));
              router.refresh();
            })
          }
        >
          {t(`result.${r === "1/2-1/2" ? "draw" : r === "1-0" ? "white" : "black"}`)}
        </button>
      ))}
      <Status msg={msg} error={!!msg && msg !== t("saved")} />
    </div>
  );
}

/** Échiquier du public : le coup choisi est proposé au vote (validé par chess.js puis par le serveur). */
export function PvmVoteBoard({
  gameId,
  fen,
  orientation,
  canVote,
  myVote,
}: {
  gameId: string;
  fen: string;
  orientation: "w" | "b";
  canVote: boolean;
  myVote: string | null;
}) {
  const t = useTranslations("community.pvm");
  const router = useRouter();
  const err = useErr();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const game = useMemo(() => new Chess(fen), [fen]);
  const legalTargets = useCallback(
    (from: string) =>
      game.moves({ square: from as never, verbose: true }).map((m) => m.to as string),
    [game],
  );
  const lastMove = myVote ? ([myVote.slice(0, 2), myVote.slice(2, 4)] as [string, string]) : null;
  return (
    <div>
      <Board
        fen={fen}
        orientation={orientation}
        interactive={canVote && !busy}
        legalTargets={legalTargets}
        lastMove={lastMove}
        label={t("boardLabel")}
        onMove={(from, to, promotion) =>
          start(async () => {
            const uci = `${from}${to}${promotion ?? ""}`;
            const r = await pvmVoteAction(gameId, uci);
            setMsg(
              r.ok
                ? { text: t("voteRecorded"), error: false }
                : { text: err(r.error), error: true },
            );
            if (r.ok) router.refresh();
          })
        }
      />
      <p className="mt-2 min-h-6" aria-live="polite">
        {msg ? <Status msg={msg.text} error={msg.error} /> : null}
      </p>
    </div>
  );
}

export function PvmControls({ gameId, publicToMove }: { gameId: string; publicToMove: boolean }) {
  const t = useTranslations("community.pvm");
  const router = useRouter();
  const err = useErr();
  const [busy, start] = useTransition();
  const [move, setMove] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMsg(err(r.error ?? "generic"));
      setMsg(null);
      setMove("");
      router.refresh();
    });
  return (
    <div className="space-y-4 rounded-lg border border-line p-4">
      <h2 className="font-display text-xl font-semibold">{t("control")}</h2>
      {publicToMove ? (
        <Button disabled={busy} onClick={() => run(() => pvmPlayPublicMoveAction(gameId))}>
          {t("playPublic")}
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => pvmMasterMoveAction(gameId, move.trim().toLowerCase()));
          }}
        >
          <Field id="pvm-move" label={t("masterMove")}>
            <Input
              id="pvm-move"
              value={move}
              onChange={(e) => setMove(e.target.value)}
              required
              pattern="[a-h][1-8][a-h][1-8][qrbnQRBN]?"
              className="font-mono"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {t("play")}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t("finish")}</span>
        {RESULTS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy}
            className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold hover:bg-surface"
            onClick={() => {
              if (confirm(t("finishConfirm", { result: r }))) run(() => pvmFinishAction(gameId, r));
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <Status msg={msg} error />
    </div>
  );
}
