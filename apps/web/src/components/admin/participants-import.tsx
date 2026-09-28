"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/form";
import { importParticipantsAction } from "@/app/actions/admin";

/** Colonnes acceptées (en-têtes français ou anglais, sans accents ni majuscules). */
const COLUMNS: Record<string, string> = {
  prenom: "first_name",
  first_name: "first_name",
  firstname: "first_name",
  nom: "last_name",
  last_name: "last_name",
  lastname: "last_name",
  naissance: "birth_date",
  date_naissance: "birth_date",
  birth_date: "birth_date",
  sexe: "sex",
  sex: "sex",
  telephone: "phone",
  phone: "phone",
  club: "club",
  fide: "fide_id",
  fide_id: "fide_id",
  paiement: "payment",
  payment: "payment",
};
const norm = (h: string) =>
  h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const PAYMENT: Record<string, string> = {
  paye: "paid",
  payé: "paid",
  paid: "paid",
  sur_place: "due_on_site",
  "sur place": "due_on_site",
  gratuit: "not_required",
};

type Report = {
  registered: number;
  already: number;
  created_profiles: number;
  matched_profiles: number;
  errors: { line: number; error: string }[];
};

export function ParticipantsImport({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("participantsImport");
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <details className="mt-6 rounded-lg border border-line p-4">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        {t("title")}
      </summary>
      <p className="mt-2 text-sm text-stone">{t("help")}</p>
      <p className="mt-1 font-mono text-xs">
        prenom;nom;naissance;sexe;telephone;club;fide;paiement
      </p>
      <label htmlFor="pi-file" className="mt-3 block text-sm font-semibold">
        {t("file")}
      </label>
      <input
        id="pi-file"
        type="file"
        accept=".csv,text/csv"
        className="mt-1 block text-sm"
        onChange={(e) => {
          setReport(null);
          setError(null);
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 1_000_000) return setError(t("tooLarge"));
          Papa.parse<Record<string, string>>(f, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => COLUMNS[norm(h)] ?? norm(h),
            complete: (res) => {
              const data = res.data.map((r) => ({
                first_name: r.first_name ?? "",
                last_name: r.last_name ?? "",
                birth_date: r.birth_date ?? "",
                sex: r.sex ?? "",
                phone: r.phone ?? "",
                club: r.club ?? "",
                fide_id: r.fide_id ?? "",
                payment:
                  PAYMENT[(r.payment ?? "").trim().toLowerCase()] ?? (r.payment ?? "").trim(),
              }));
              if (
                !data.length ||
                !res.meta.fields?.includes("first_name") ||
                !res.meta.fields.includes("last_name")
              )
                return setError(t("badHeader"));
              if (data.length > 1000) return setError(t("tooMany"));
              setRows(data);
            },
            error: () => setError(t("badFile")),
          });
        }}
      />
      {rows ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">{t("ready", { n: rows.length })}</span>
          <Button
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await importParticipantsAction(tournamentId, rows);
                if (!r.ok) return setError(t(r.error === "forbidden" ? "forbidden" : "badFile"));
                setReport(r.data!);
                setRows(null);
                router.refresh();
              })
            }
          >
            {t("import")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-bordeaux">
          {error}
        </p>
      ) : null}
      {report ? (
        <div role="status" className="mt-3 text-sm">
          <p className="font-semibold text-success">
            {t("report", {
              registered: report.registered,
              already: report.already,
              created: report.created_profiles,
              matched: report.matched_profiles,
            })}
          </p>
          {report.errors.length ? (
            <ul className="mt-1 list-disc pl-5 text-bordeaux">
              {report.errors.slice(0, 30).map((e) => (
                <li key={e.line}>
                  {t("lineError", {
                    line: e.line + 1,
                    error: t.has(`errors.${e.error}`) ? t(`errors.${e.error}`) : e.error,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
