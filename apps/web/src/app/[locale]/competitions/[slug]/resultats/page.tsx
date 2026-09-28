import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getTournamentBySlug } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IconDownload } from "@/components/icons";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  return t ? { title: `${t.name} — résultats` } : {};
}

const TB_LABELS: Record<string, string> = {
  buchholz_cut1: "Bu-1",
  buchholz: "Bu",
  sonneborn_berger: "SB",
  direct_encounter: "DE",
  wins: "V",
  performance: "Perf",
};

export default async function ResultsPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [{ data: standings }, { data: games }] = await Promise.all([
    supabase.from("public_standings").select("*").eq("tournament_id", t.id).order("rank"),
    supabase
      .from("games")
      .select("id, round_number, board, white_name, black_name, result, moves_count")
      .eq("tournament_id", t.id)
      .order("round_number")
      .order("board"),
  ]);
  const tbs = t.tiebreaks.filter((k) => k in TB_LABELS);
  const rounds = [...new Set((games ?? []).map((g) => g.round_number))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <nav className="text-sm text-stone">
        <Link href={`/competitions/${t.slug}`} className="hover:text-accent">
          {t.name}
        </Link>
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
        {tt("results")} {t.is_demo ? <DemoBadge /> : null}
      </h1>
      <p className="mt-2 text-stone first-letter:uppercase">
        {formatDate(t.starts_at, locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      {!standings?.length ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line p-6 font-serif text-lg text-stone">
          {tt("resultsSoon")}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
            <thead className="bg-surface/70 text-xs uppercase tracking-[0.08em] text-stone">
              <tr>
                <th className="px-3 py-2">{tt("rank")}</th>
                <th className="px-3 py-2">{tt("player")}</th>
                <th className="px-3 py-2">{tt("club")}</th>
                <th className="px-3 py-2 text-right">{tt("rating")}</th>
                <th className="px-3 py-2 text-right">{tt("points")}</th>
                {tbs.map((k) => (
                  <th key={k} className="px-3 py-2 text-right" title={k}>
                    {TB_LABELS[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {standings.map((s) => {
                const tb = (s.tiebreaks ?? {}) as Record<string, number>;
                return (
                  <tr key={s.player_id} className={s.rank! <= 3 ? "bg-gold-soft/30" : undefined}>
                    <td className="tabular px-3 py-2 font-display text-lg text-accent">{s.rank}</td>
                    <td className="px-3 py-2 font-medium">
                      {s.titles?.length ? (
                        <span className="mr-1.5 text-xs font-bold text-accent">
                          {s.titles.join(" ")}
                        </span>
                      ) : null}
                      {s.display_name}
                      {s.prize ? <span className="ml-2 text-xs text-accent">{s.prize}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-stone">{s.club ?? ""}</td>
                    <td className="tabular px-3 py-2 text-right">{s.rating_before ?? "—"}</td>
                    <td className="tabular px-3 py-2 text-right font-semibold">{s.points}</td>
                    {tbs.map((k) => (
                      <td key={k} className="tabular px-3 py-2 text-right text-stone">
                        {tb[k] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {games?.length ? (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold">{tt("games")}</h2>
            <a
              href={`/api/tournaments/${t.slug}/pgn`}
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline"
            >
              <IconDownload className="size-5" /> {tt("downloadPgn")}
            </a>
          </div>
          {rounds.map((r) => (
            <div key={r} className="mt-6">
              <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.12em] text-stone">
                {tt("roundN", { n: r ?? 0 })}
              </h3>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {games
                  .filter((g) => g.round_number === r)
                  .map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/parties/${g.id}`}
                        className="grid grid-cols-[2rem_1fr_4.5rem_1fr] items-center gap-2 py-2 text-[0.95rem] hover:bg-surface/60"
                      >
                        <span className="tabular text-stone">{g.board}</span>
                        <span className="truncate text-right">{g.white_name}</span>
                        <span className="tabular text-center font-semibold">
                          {g.result.replace("1/2", "½").replace("1/2", "½")}
                        </span>
                        <span className="truncate">{g.black_name}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
