"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@chesspirit/shared";
import { useRouter } from "@/i18n/navigation";
import { Button, Field, Input, Select } from "@/components/ui/form";
import {
  createLichessArenaAction,
  importLichessAction,
  setLichessLinkAction,
} from "@/app/actions/online";

export function OnlinePanel({
  tournamentId,
  kind,
  lichessId,
  importedAt,
  canCreate,
  players,
}: {
  tournamentId: string;
  kind: string | null;
  lichessId: string | null;
  importedAt: string | null;
  canCreate: boolean;
  players: { name: string; username: string | null }[];
}) {
  const t = useTranslations("onlineAdmin");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ kind: kind ?? "arena", id: lichessId ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const err = (e: string) => (t.has(`errors.${e}`) ? t(`errors.${e}`) : t("errors.generic"));
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">{t("lichess")}</h2>
        <p className="text-sm text-stone">{t("help")}</p>
        <form
          className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setLichessLinkAction(tournamentId, v.kind as "arena" | "swiss", v.id);
              setMsg(r.ok ? t("saved") : err(r.error));
              router.refresh();
            });
          }}
        >
          <Field id="lk" label={t("kind")}>
            <Select id="lk" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              <option value="arena">Arena</option>
              <option value="swiss">{t("swiss")}</option>
            </Select>
          </Field>
          <Field id="lid" label={t("id")}>
            <Input id="lid" value={v.id} onChange={(e) => setV({ ...v, id: e.target.value })} />
          </Field>
          <Button type="submit" disabled={pending}>
            {t("link")}
          </Button>
        </form>
        <div className="flex flex-wrap gap-3">
          {canCreate && !lichessId ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createLichessArenaAction(tournamentId);
                  setMsg(r.ok ? t("created", { id: r.data! }) : err(r.error));
                  router.refresh();
                })
              }
            >
              {t("createArena")}
            </Button>
          ) : null}
          {lichessId ? (
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await importLichessAction(tournamentId);
                  setMsg(
                    r.ok
                      ? t("imported", {
                          players: r.data!.players,
                          games: r.data!.games,
                          unknown: r.data!.unknown.length,
                        }) +
                          (r.data!.unknown.length
                            ? ` (${r.data!.unknown.slice(0, 20).join(", ")})`
                            : "")
                      : err(r.error),
                  );
                  router.refresh();
                })
              }
            >
              {t("import")}
            </Button>
          ) : null}
        </div>
        {!canCreate ? <p className="text-sm text-stone">{t("noToken")}</p> : null}
        {importedAt ? (
          <p className="text-sm text-stone">
            {t("lastImport", { date: formatDateTime(importedAt, locale) })}
          </p>
        ) : null}
        {msg ? (
          <p role="status" className="rounded bg-cream px-3 py-2 text-sm font-semibold">
            {msg}
          </p>
        ) : null}
        <div className="rounded-lg bg-gold-soft/50 p-4 text-sm">
          <p className="font-semibold">{t("fairPlayTitle")}</p>
          <p className="mt-1">{t("fairPlayText")}</p>
        </div>
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("players")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {players.map((p, i) => (
            <li key={i} className="flex gap-3 py-2">
              <span className="min-w-0 flex-1">{p.name}</span>
              <span className={p.username ? "font-mono" : "text-bordeaux"}>
                {p.username ?? t("notLinked")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
