"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@chesspirit/shared";
import { offlinePackAction, type OfflinePack } from "@/app/actions/offline";
import { setResultAction } from "@/app/actions/rounds";
import { idbDelete, idbEntries, idbGet, idbSet } from "@/lib/offline-db";

const RESULTS = ["1-0", "1/2-1/2", "0-1", "+-", "-+"] as const;
type Queued = { pairingId: string; result: string; at: string };

/**
 * Saisie des résultats sans connexion : le tableau des rondes est gardé dans IndexedDB,
 * les résultats saisis hors ligne sont mis en file puis envoyés dès le retour du réseau.
 */
export function OfflineArbiter({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("offline");
  const locale = useLocale();
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const all = await idbEntries<Queued>("queue");
    setQueue(all.filter(([k]) => k.startsWith(`${tournamentId}:`)).map(([, v]) => v));
  }, [tournamentId]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await offlinePackAction(tournamentId);
      if (fresh) {
        await idbSet("packs", tournamentId, fresh);
        setPack(fresh);
      }
    } catch {
      // réseau indisponible : on garde la copie locale
    }
  }, [tournamentId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    const all = (await idbEntries<Queued>("queue")).filter(([k]) =>
      k.startsWith(`${tournamentId}:`),
    );
    let sent = 0;
    for (const [key, q] of all) {
      try {
        const r = await setResultAction(q.pairingId, q.result === "none" ? null : q.result);
        if (r.ok) {
          await idbDelete("queue", key);
          sent++;
        }
      } catch {
        break;
      }
    }
    await loadQueue();
    await refresh();
    setSyncing(false);
    if (sent) setMsg(t("synced", { n: sent }));
  }, [tournamentId, loadQueue, refresh, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await idbGet<OfflinePack>("packs", tournamentId);
      if (!cancelled && local) setPack(local);
      await loadQueue();
      if (!cancelled) setOnline(navigator.onLine);
      if (navigator.onLine) await sync();
    })();
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) {
      const scope = location.pathname.startsWith("/en/") ? "/en/arbitrage/" : "/arbitrage/";
      navigator.serviceWorker.register("/sw-arbitrage.js", { scope }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [tournamentId, loadQueue, sync]);

  async function enter(pairingId: string, result: string) {
    await idbSet("queue", `${tournamentId}:${pairingId}`, {
      pairingId,
      result,
      at: new Date().toISOString(),
    });
    setPack((p) =>
      p
        ? {
            ...p,
            rounds: p.rounds.map((r) => ({
              ...r,
              pairings: r.pairings.map((x) =>
                x.id === pairingId ? { ...x, result: result === "none" ? null : result } : x,
              ),
            })),
          }
        : p,
    );
    await loadQueue();
    if (navigator.onLine) await sync();
  }

  const pending = new Set(queue.map((q) => q.pairingId));
  return (
    <div>
      <p
        role="status"
        className={`rounded-lg px-4 py-3 font-semibold ${online ? "bg-cream" : "bg-bordeaux text-cream"}`}
      >
        {online ? t("online") : t("offline")} · {t("pending", { n: queue.length })}
        {syncing ? ` · ${t("syncing")}` : ""}
      </p>
      {msg ? <p className="mt-2 text-sm font-semibold">{msg}</p> : null}
      {pack ? (
        <>
          <p className="mt-4 text-sm text-stone">
            {pack.name} · {t("savedAt", { date: formatDateTime(pack.savedAt, locale) })}
          </p>
          {pack.rounds.map((r) => (
            <section key={r.id} className="mt-6">
              <h2 className="font-display text-2xl font-semibold">{t("round", { n: r.number })}</h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {r.pairings.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="tabular w-8 font-semibold">{p.board}</span>
                    <span className="min-w-0 flex-1">
                      {p.white} – {p.black ?? t("bye")}
                      {pending.has(p.id) ? (
                        <span className="ml-2 text-xs font-semibold text-bordeaux">
                          {t("notSent")}
                        </span>
                      ) : null}
                    </span>
                    {p.black ? (
                      <span className="flex flex-wrap gap-1">
                        {RESULTS.map((res) => (
                          <button
                            key={res}
                            type="button"
                            aria-pressed={p.result === res}
                            aria-label={t("setResult", { board: p.board, result: res })}
                            onClick={() => void enter(p.id, p.result === res ? "none" : res)}
                            className={`min-h-11 min-w-11 rounded-md border px-2 font-semibold ${p.result === res ? "border-ink bg-ink text-cream" : "border-line"}`}
                          >
                            {res === "1/2-1/2" ? "½" : res}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!pack.rounds.length ? <p className="mt-4 text-stone">{t("noRounds")}</p> : null}
        </>
      ) : (
        <p className="mt-4 text-stone">{online ? t("loading") : t("noCopy")}</p>
      )}
    </div>
  );
}
