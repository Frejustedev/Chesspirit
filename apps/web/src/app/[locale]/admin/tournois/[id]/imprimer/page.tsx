import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatTimeControl } from "@chesspirit/shared";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { loadState } from "@/lib/tournament-engine";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/ui/print-button";

export const metadata: Metadata = { robots: { index: false } };

type Kind = "appariements" | "cartes" | "feuilles";

/** Documents imprimables : appariements, cartes de table, feuilles de notation. */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ ronde?: string; type?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { ronde, type } = await searchParams;
  await requireStaff(locale, `/admin/tournois/${id}/imprimer`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const kind: Kind = type === "cartes" || type === "feuilles" ? type : "appariements";
  const t = await getTranslations("print");
  const supabase = await createClient();
  const st = await loadState(supabase, id);
  const round = st.rounds.find((r) => r.number === Number(ronde)) ?? st.rounds.at(-1);
  if (!round) notFound();
  const byId = new Map(st.participants.map((p) => [p.playerId, p]));
  const boards = st.pairings
    .filter((p) => p.round_id === round.id && p.stage === "main")
    .sort((a, b) => (a.board || 999) - (b.board || 999));
  const tn = st.tournament;
  const tc = tn.base_minutes
    ? formatTimeControl({
        baseMinutes: tn.base_minutes,
        incrementSeconds: tn.increment_seconds ?? 0,
      })
    : "";
  const name = (pid: string | null) => (pid ? (byId.get(pid)?.name ?? "") : t("bye"));
  const tabs: Kind[] = ["appariements", "cartes", "feuilles"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        {tabs.map((k) => (
          <a
            key={k}
            href={`?ronde=${round.number}&type=${k}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${k === kind ? "border-bordeaux bg-bordeaux text-cream" : "border-line"}`}
          >
            {t(k)}
          </a>
        ))}
        <span className="ml-auto">
          <PrintButton />
        </span>
      </div>

      {kind === "appariements" ? (
        <section>
          <header className="flex items-baseline justify-between border-b-2 border-fg pb-2">
            <div>
              <h1 className="font-display text-3xl font-semibold">{tn.name}</h1>
              <p>
                {t("round", { n: round.number })} · {formatDate(tn.starts_at, locale)}
              </p>
            </div>
            <Logo className="text-2xl" />
          </header>
          <table className="mt-4 w-full text-[1.05rem]">
            <thead>
              <tr className="border-b border-fg text-left">
                <th className="py-1">{t("board")}</th>
                <th className="py-1">{t("white")}</th>
                <th className="py-1 text-center">{t("result")}</th>
                <th className="py-1">{t("black")}</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((b) => (
                <tr key={b.id} className="border-b border-line">
                  <td className="tabular py-1.5">{b.board || ""}</td>
                  <td className="py-1.5">
                    {name(b.white_id)}{" "}
                    <span className="tabular text-sm">({byId.get(b.white_id)?.startNo})</span>
                  </td>
                  <td className="py-1.5 text-center">{b.black_id ? (b.result ?? "") : ""}</td>
                  <td className="py-1.5">
                    {b.black_id ? (
                      <>
                        {name(b.black_id)}{" "}
                        <span className="tabular text-sm">({byId.get(b.black_id)?.startNo})</span>
                      </>
                    ) : (
                      t("bye")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : kind === "cartes" ? (
        <section className="grid grid-cols-2 gap-4 print:gap-0">
          {boards
            .filter((b) => b.black_id)
            .map((b) => (
              <div
                key={b.id}
                className="break-inside-avoid border-2 border-dashed border-fg p-5 text-center"
              >
                <p className="text-sm uppercase tracking-[0.2em]">{tn.name}</p>
                <p className="font-display text-[5rem] font-semibold leading-none">{b.board}</p>
                <p className="text-sm">{t("round", { n: round.number })}</p>
              </div>
            ))}
        </section>
      ) : (
        <section>
          {boards
            .filter((b) => b.black_id)
            .map((b) => (
              <div key={b.id} className="mb-8 break-after-page border border-fg p-4 text-sm">
                <div className="flex justify-between border-b border-fg pb-2">
                  <span className="font-semibold">{tn.name}</span>
                  <span>
                    {t("round", { n: round.number })} · {t("board")} {b.board} {tc ? `· ${tc}` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-b border-fg py-2">
                  <p>
                    {t("white")} : <strong>{name(b.white_id)}</strong>
                  </p>
                  <p>
                    {t("black")} : <strong>{name(b.black_id)}</strong>
                  </p>
                </div>
                <table className="mt-2 w-full border-collapse text-xs">
                  <tbody>
                    {Array.from({ length: 30 }, (_, i) => (
                      <tr key={i}>
                        <td className="w-8 border border-line px-1 text-right">{i + 1}</td>
                        <td className="h-5 border border-line" />
                        <td className="h-5 border border-line" />
                        <td className="w-8 border border-line px-1 text-right">{i + 31}</td>
                        <td className="h-5 border border-line" />
                        <td className="h-5 border border-line" />
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <p>{t("result")} : ________</p>
                  <p>{t("signWhite")} : ________</p>
                  <p>{t("signBlack")} : ________</p>
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
