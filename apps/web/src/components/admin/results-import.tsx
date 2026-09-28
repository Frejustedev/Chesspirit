"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { importPgnAction, importStandingsAction } from "@/app/actions/admin";

const HEADER_ALIASES: Record<string, string> = {
  rang: "rank",
  rank: "rank",
  rg: "rank",
  "#": "rank",
  pos: "rank",
  nom: "name",
  name: "name",
  joueur: "name",
  player: "name",
  points: "points",
  pts: "points",
  score: "points",
  cote: "rating",
  elo: "rating",
  rating: "rating",
  club: "club",
  fide: "fide_id",
  fide_id: "fide_id",
  "id fide": "fide_id",
  telephone: "phone",
  téléphone: "phone",
  phone: "phone",
};

/** Import du classement final (CSV ou collage depuis un tableur) et des parties PGN. */
export function ResultsImport({ tournamentId, slug }: { tournamentId: string; slug: string }) {
  const t = useTranslations("admin");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pgnMsg, setPgnMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function parse(text: string) {
    setCsv(text);
    const res = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [";", ",", "\t"],
      transformHeader: (h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase(),
    });
    setRows(res.data.filter((r) => r.name && r.rank));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("standingsTitle")}</h2>
        <p className="mt-2 text-sm text-stone">{t("standingsHelp")}</p>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-label={t("csvFile")}
          className="mt-3 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-surface file:px-4 file:font-semibold"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) parse(await f.text());
          }}
        />
        <label htmlFor="csv" className="mt-3 block text-sm font-semibold">
          {t("csvPaste")}
        </label>
        <textarea
          id="csv"
          value={csv}
          onChange={(e) => parse(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-md border border-line bg-field p-3 font-mono text-sm"
          placeholder={"rang;nom;points;cote;club\n1;Nom Prénom;6;1850;Club"}
        />
        {rows.length ? (
          <>
            <p className="mt-3 text-sm font-semibold">{t("preview", { n: rows.length })}</p>
            <ol className="mt-2 max-h-56 overflow-auto rounded-md border border-line text-sm">
              {rows.slice(0, 50).map((r, i) => (
                <li key={i} className="flex gap-3 border-b border-line px-3 py-1.5 last:border-0">
                  <span className="tabular w-8 text-stone">{r.rank}</span>
                  <span className="flex-1">{r.name}</span>
                  <span className="tabular">{r.points}</span>
                </li>
              ))}
            </ol>
            <Button
              className="mt-4"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await importStandingsAction(tournamentId, rows);
                  setMsg(
                    r.ok ? t("imported", { n: r.data ?? 0 }) : `${t("importError")} (${r.error})`,
                  );
                })
              }
            >
              {t("importStandings")}
            </Button>
          </>
        ) : null}
        {msg ? (
          <p role="status" className="mt-3 rounded bg-surface px-3 py-2 text-sm font-semibold">
            {msg}{" "}
            <Link href={`/competitions/${slug}/resultats`} className="text-accent underline">
              {t("seeResults")}
            </Link>
          </p>
        ) : null}
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("pgnTitle")}</h2>
        <p className="mt-2 text-sm text-stone">{t("pgnHelp")}</p>
        <input
          type="file"
          multiple
          accept=".pgn,application/x-chess-pgn,text/plain"
          aria-label={t("pgnFile")}
          className="mt-3 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-surface file:px-4 file:font-semibold"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (!files.length) return;
            start(async () => {
              const text = (await Promise.all(files.map((f) => f.text()))).join("\n\n");
              const r = await importPgnAction(tournamentId, text);
              setPgnMsg(r.ok ? t("pgnImported", r.data!) : `${t("importError")} (${r.error})`);
            });
          }}
        />
        {pending ? <p className="mt-3 text-sm text-stone">{t("loading")}</p> : null}
        <h2 className="mt-10 font-display text-2xl font-semibold">{t("exportsTitle")}</h2>
        <ul className="mt-3 space-y-2">
          <li>
            <a
              href={`/api/admin/tournaments/${tournamentId}/trf`}
              className="font-semibold text-accent hover:underline"
            >
              {t("exportTrf")}
            </a>
          </li>
          <li>
            <a
              href={`/api/admin/tournaments/${tournamentId}/rapport`}
              className="font-semibold text-accent hover:underline"
            >
              {t("exportReport")}
            </a>
          </li>
          <li>
            <a
              href={`/api/tournaments/${slug}/pgn`}
              className="font-semibold text-accent hover:underline"
            >
              {t("exportPgn")}
            </a>
          </li>
        </ul>
        {pgnMsg ? (
          <p role="status" className="mt-3 rounded bg-surface px-3 py-2 text-sm font-semibold">
            {pgnMsg}
          </p>
        ) : null}
      </section>
    </div>
  );
}
