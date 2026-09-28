"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Field, Input, Select } from "@/components/ui/form";
import {
  addMemberAction,
  addStageAction,
  allocateAction,
  closeLeagueAction,
  computeStageAction,
  createMatchdayAction,
  createSeasonAction,
  refreshForfeitsAction,
  saveSeasonAction,
  setMemberStatusAction,
  updateStageAction,
} from "@/app/actions/admin-leagues";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? (okMsg ?? null) : (r.error ?? "error"));
      if (r.ok) router.refresh();
    });
  return { pending, msg, run, router };
}

function Msg({ text }: { text: string | null }) {
  const t = useTranslations("adminLeagues");
  if (!text) return null;
  return (
    <span role="status" className="text-sm font-semibold">
      {t.has(`msg.${text}`) ? t(`msg.${text}`) : text}
    </span>
  );
}

export function NewSeasonForm() {
  const t = useTranslations("adminLeagues");
  const { pending, msg, run, router } = useRun();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ slug: "", name: "", startsOn: "", endsOn: "" });
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("newSeason")}
      </Button>
    );
  return (
    <form
      className="grid w-full gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await createSeasonAction(v);
          if (r.ok) router.push(`/admin/ligues?saison=${r.data!.slug}`);
          return r;
        });
      }}
    >
      <Field id="s-name" label={t("seasonName")}>
        <Input
          id="s-name"
          required
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
      </Field>
      <Field id="s-slug" label={t("seasonSlug")} hint="2027-2028">
        <Input
          id="s-slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={v.slug}
          onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })}
        />
      </Field>
      <Field id="s-start" label={t("startsOn")}>
        <Input
          id="s-start"
          type="date"
          required
          value={v.startsOn}
          onChange={(e) => setV({ ...v, startsOn: e.target.value })}
        />
      </Field>
      <Field id="s-end" label={t("endsOn")}>
        <Input
          id="s-end"
          type="date"
          required
          value={v.endsOn}
          onChange={(e) => setV({ ...v, endsOn: e.target.value })}
        />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("createSeason")}
        </Button>
        <Msg text={msg} />
      </div>
    </form>
  );
}

export function SeasonSettings({
  season,
}: {
  season: {
    id: string;
    status: string;
    licenseFee: number | null;
    bestResults: number;
    mastersQualified: number;
    mastersInvited: number;
    rules: string;
  };
}) {
  const t = useTranslations("adminLeagues");
  const tl = useTranslations("leagues");
  const { pending, msg, run } = useRun();
  const [v, setV] = useState({
    ...season,
    fee: season.licenseFee === null ? "" : String(season.licenseFee),
  });
  return (
    <form
      className="mt-4 grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveSeasonAction({
              id: v.id,
              status: v.status,
              licenseFee: v.fee === "" ? null : Math.round(Number(v.fee)),
              bestResults: Number(v.bestResults),
              mastersQualified: Number(v.mastersQualified),
              mastersInvited: Number(v.mastersInvited),
              rules: v.rules,
            }),
          "saved",
        );
      }}
    >
      <Field id="st-status" label={t("status")}>
        <Select
          id="st-status"
          value={v.status}
          onChange={(e) => setV({ ...v, status: e.target.value })}
        >
          {(["planned", "active", "closed"] as const).map((s) => (
            <option key={s} value={s}>
              {tl(`seasonStatus.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="st-fee" label={t("licenseFee")} hint={t("licenseFeeHint")}>
        <Input
          id="st-fee"
          type="number"
          min={0}
          value={v.fee}
          onChange={(e) => setV({ ...v, fee: e.target.value })}
        />
      </Field>
      <Field id="st-best" label={t("bestResults")}>
        <Input
          id="st-best"
          type="number"
          min={1}
          max={20}
          value={v.bestResults}
          onChange={(e) => setV({ ...v, bestResults: Number(e.target.value) })}
        />
      </Field>
      <Field id="st-mq" label={t("mastersQualified")}>
        <Input
          id="st-mq"
          type="number"
          min={0}
          value={v.mastersQualified}
          onChange={(e) => setV({ ...v, mastersQualified: Number(e.target.value) })}
        />
      </Field>
      <Field id="st-mi" label={t("mastersInvited")}>
        <Input
          id="st-mi"
          type="number"
          min={0}
          value={v.mastersInvited}
          onChange={(e) => setV({ ...v, mastersInvited: Number(e.target.value) })}
        />
      </Field>
      <div className="sm:col-span-3">
        <label htmlFor="st-rules" className="block text-sm font-semibold">
          {t("rules")}
        </label>
        <textarea
          id="st-rules"
          rows={6}
          value={v.rules}
          onChange={(e) => setV({ ...v, rules: e.target.value })}
          className="mt-1 w-full rounded-md border border-line bg-white p-3 font-mono text-sm"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <Msg text={msg} />
      </div>
    </form>
  );
}

export function LeagueRowActions({ leagueId, seasonId }: { leagueId?: string; seasonId?: string }) {
  const t = useTranslations("adminLeagues");
  const { pending, msg, run, router } = useRun();
  const [day, setDay] = useState("");
  if (seasonId)
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (confirm(t("allocateConfirm"))) run(() => allocateAction(seasonId), "allocated");
          }}
        >
          {t("allocate")}
        </Button>
        <Msg text={msg} />
      </div>
    );
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label htmlFor={`day-${leagueId}`} className="sr-only">
        {t("matchdayDate")}
      </label>
      <input
        id={`day-${leagueId}`}
        type="date"
        value={day}
        onChange={(e) => setDay(e.target.value)}
        className="min-h-10 rounded-md border border-line bg-white px-2 text-sm"
      />
      <Button
        className="min-h-10 px-3 text-sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await createMatchdayAction(leagueId!, day || undefined);
            if (r.ok) router.push(`/admin/tournois/${r.data!.tournamentId}`);
            return r;
          })
        }
      >
        {t("createMatchday")}
      </Button>
      <Button
        variant="secondary"
        className="min-h-10 px-3 text-sm"
        disabled={pending}
        onClick={() => run(() => refreshForfeitsAction(leagueId!), "forfeitsUpdated")}
      >
        {t("refreshForfeits")}
      </Button>
      <Button
        variant="secondary"
        className="min-h-10 px-3 text-sm"
        disabled={pending}
        onClick={() => {
          if (confirm(t("closeConfirm"))) run(() => closeLeagueAction(leagueId!), "closed");
        }}
      >
        {t("closeLeague")}
      </Button>
      <Msg text={msg} />
    </div>
  );
}

export function MemberStatus({
  leagueId,
  profileId,
  status,
}: {
  leagueId: string;
  profileId: string;
  status: string;
}) {
  const t = useTranslations("adminLeagues");
  const { pending, run } = useRun();
  return (
    <>
      <label htmlFor={`ms-${leagueId}-${profileId}`} className="sr-only">
        {t("status")}
      </label>
      <select
        id={`ms-${leagueId}-${profileId}`}
        defaultValue={status}
        disabled={pending}
        className="min-h-10 rounded-md border border-line bg-white px-2"
        onChange={(e) =>
          run(() =>
            setMemberStatusAction(
              leagueId,
              profileId,
              e.target.value as "active" | "withdrawn" | "excluded" | "remove",
            ),
          )
        }
      >
        {(["active", "withdrawn", "excluded", "remove"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`memberStatus.${s}`)}
          </option>
        ))}
      </select>
    </>
  );
}

export function MemberAdd({ leagueId }: { leagueId: string }) {
  const t = useTranslations("adminLeagues");
  const { pending, msg, run } = useRun();
  const [v, setV] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await addMemberAction(leagueId, v);
          if (r.ok) setV("");
          return r;
        }, "added");
      }}
    >
      <label htmlFor={`add-${leagueId}`} className="sr-only">
        {t("addMember")}
      </label>
      <input
        id={`add-${leagueId}`}
        value={v}
        placeholder={t("addMemberPlaceholder")}
        onChange={(e) => setV(e.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm"
      />
      <Button type="submit" className="min-h-10 px-3 text-sm" disabled={pending || !v}>
        {t("addMember")}
      </Button>
      <Msg text={msg} />
    </form>
  );
}

type T = { id: string; name: string };

export function StageRow({
  stage,
  tournaments,
}: {
  stage: {
    id: string;
    number: number;
    name: string;
    kind: string;
    coefficient: number;
    tournamentId: string | null;
    status: string;
  };
  tournaments: T[];
}) {
  const t = useTranslations("adminLeagues");
  const tt = useTranslations("tour");
  const { pending, msg, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-line p-3 text-sm">
      <span className="tabular w-6 font-semibold">{stage.number}</span>
      <span className="min-w-0 flex-1 font-semibold">{stage.name}</span>
      <label htmlFor={`kind-${stage.id}`} className="sr-only">
        {t("kind")}
      </label>
      <select
        id={`kind-${stage.id}`}
        defaultValue={stage.kind}
        disabled={pending}
        className="min-h-10 rounded-md border border-line bg-white px-2"
        onChange={(e) => run(() => updateStageAction(stage.id, { kind: e.target.value }))}
      >
        {(["regular", "major", "online", "masters"] as const).map((k) => (
          <option key={k} value={k}>
            {tt(`kind.${k}`)}
          </option>
        ))}
      </select>
      <label htmlFor={`coef-${stage.id}`} className="sr-only">
        {t("coefficient")}
      </label>
      <input
        id={`coef-${stage.id}`}
        type="number"
        step="0.1"
        min={0}
        max={3}
        defaultValue={stage.coefficient}
        disabled={pending}
        onBlur={(e) => {
          const c = Number(e.target.value);
          if (c !== stage.coefficient) run(() => updateStageAction(stage.id, { coefficient: c }));
        }}
        className="tabular min-h-10 w-20 rounded-md border border-line bg-white px-2"
      />
      <label htmlFor={`tn-${stage.id}`} className="sr-only">
        {t("tournament")}
      </label>
      <select
        id={`tn-${stage.id}`}
        defaultValue={stage.tournamentId ?? ""}
        disabled={pending}
        className="min-h-10 max-w-60 rounded-md border border-line bg-white px-2"
        onChange={(e) =>
          run(() => updateStageAction(stage.id, { tournamentId: e.target.value || null }))
        }
      >
        <option value="">{t("noTournament")}</option>
        {tournaments.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      {stage.tournamentId ? (
        <Button
          variant="secondary"
          className="min-h-10 px-3 text-sm"
          disabled={pending}
          onClick={() => run(() => computeStageAction(stage.tournamentId!), "computed")}
        >
          {t("computePoints")}
        </Button>
      ) : null}
      <Msg text={msg} />
    </li>
  );
}

export function AddStageForm({ seasonId, tournaments }: { seasonId: string; tournaments: T[] }) {
  const t = useTranslations("adminLeagues");
  const tt = useTranslations("tour");
  const { pending, msg, run } = useRun();
  const [v, setV] = useState({
    name: "",
    city: "",
    plannedOn: "",
    kind: "regular",
    tournamentId: "",
  });
  return (
    <form
      className="mt-4 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await addStageAction({ seasonId, ...v });
          if (r.ok) setV({ name: "", city: "", plannedOn: "", kind: "regular", tournamentId: "" });
          return r;
        }, "added");
      }}
    >
      <Field id="stg-name" label={t("stageName")}>
        <Input
          id="stg-name"
          required
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
      </Field>
      <Field id="stg-city" label={t("city")}>
        <Input
          id="stg-city"
          value={v.city}
          onChange={(e) => setV({ ...v, city: e.target.value })}
        />
      </Field>
      <Field id="stg-date" label={t("date")}>
        <Input
          id="stg-date"
          type="date"
          value={v.plannedOn}
          onChange={(e) => setV({ ...v, plannedOn: e.target.value })}
        />
      </Field>
      <Field id="stg-kind" label={t("kind")}>
        <Select id="stg-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
          {(["regular", "major", "online", "masters"] as const).map((k) => (
            <option key={k} value={k}>
              {tt(`kind.${k}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="stg-t" label={t("tournament")}>
        <Select
          id="stg-t"
          value={v.tournamentId}
          onChange={(e) => setV({ ...v, tournamentId: e.target.value })}
        >
          <option value="">{t("noTournament")}</option>
          {tournaments.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end gap-3">
        <Button type="submit" disabled={pending}>
          {t("addStage")}
        </Button>
        <Msg text={msg} />
      </div>
    </form>
  );
}
