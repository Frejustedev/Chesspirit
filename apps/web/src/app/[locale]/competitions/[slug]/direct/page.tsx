import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getTournamentBySlug } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { Logo } from "@/components/logo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ projection?: string; ronde?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTournamentBySlug((await params).slug);
  return t ? { title: `${t.name} — direct` } : {};
}

const fmt = (r: string | null) => (r ? r.replace(/1\/2/g, "½") : "–");

export default async function LivePage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { projection, ronde } = await searchParams;
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();
  const tr = await getTranslations("live");
  const supabase = await createClient();
  const [{ data: pairings }, { data: standings }] = await Promise.all([
    supabase
      .from("public_pairings")
      .select("*")
      .eq("tournament_id", t.id)
      .order("round_number")
      .order("board"),
    supabase.from("public_standings").select("*").eq("tournament_id", t.id).order("rank"),
  ]);
  const rounds = [...new Set((pairings ?? []).map((p) => p.round_number!))];
  const current = ronde && rounds.includes(Number(ronde)) ? Number(ronde) : rounds.at(-1);
  const boards = (pairings ?? [])
    .filter((p) => p.round_number === current)
    .sort((a, b) => (a.board || 999) - (b.board || 999));
  const big = projection === "1";

  const pairingsTable = (
    <table className={`w-full text-left ${big ? "text-[1.7vw] leading-tight" : "text-[0.95rem]"}`}>
      <thead className={big ? "text-cream/60" : "text-xs uppercase tracking-[0.08em] text-stone"}>
        <tr>
          <th className="px-2 py-1">{tr("board")}</th>
          <th className="px-2 py-1 text-right">{tr("white")}</th>
          <th className="px-2 py-1 text-center">{tr("result")}</th>
          <th className="px-2 py-1">{tr("black")}</th>
        </tr>
      </thead>
      <tbody className={big ? "divide-y divide-cream/10" : "divide-y divide-line"}>
        {boards.map((b) => (
          <tr key={b.id}>
            <td className="tabular px-2 py-1.5">{b.board || ""}</td>
            <td className="px-2 py-1.5 text-right font-semibold">
              {b.white_name}{" "}
              <span className={`tabular text-[0.7em] ${big ? "text-cream/50" : "text-stone"}`}>
                {b.white_start}
              </span>
            </td>
            <td
              className={`tabular px-2 py-1.5 text-center font-semibold ${big ? "text-gold" : "text-accent"}`}
            >
              {b.black_id ? fmt(b.result) : tr("bye")}
            </td>
            <td className="px-2 py-1.5 font-semibold">
              {b.black_name ?? ""}{" "}
              <span className={`tabular text-[0.7em] ${big ? "text-cream/50" : "text-stone"}`}>
                {b.black_start ?? ""}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const standingsTable = (
    <ol className={big ? "text-[1.5vw] leading-snug" : "text-[0.95rem]"}>
      {(standings ?? []).slice(0, big ? 16 : 100).map((s) => (
        <li
          key={s.player_id}
          className={`flex gap-3 border-b py-1 ${big ? "border-cream/10" : "border-line"}`}
        >
          <span className={`tabular w-8 text-right ${big ? "text-gold" : "text-accent"}`}>
            {s.rank}
          </span>
          <span className="flex-1 truncate">{s.display_name}</span>
          <span className="tabular font-semibold">{s.points}</span>
        </li>
      ))}
    </ol>
  );

  if (big) {
    return (
      <div className="fixed inset-0 z-[60] overflow-hidden bg-ink p-[2vw] text-cream">
        <LiveRefresh tournamentId={t.id} fallbackSeconds={15} />
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[2.6vw] font-semibold">
            {t.name} — {current ? tr("round", { n: current }) : tr("noRound")}
          </p>
          <Logo tone="light" className="text-[2.2vw]" />
        </div>
        <div className="mt-[1.5vw] grid h-[85vh] grid-cols-[1.6fr_1fr] gap-[2vw]">
          <div className="overflow-hidden">{pairingsTable}</div>
          <div className="overflow-hidden">
            <p className="mb-2 text-[1.2vw] uppercase tracking-[0.2em] text-gold">
              {tr("standings")}
            </p>
            {standingsTable}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <LiveRefresh tournamentId={t.id} />
      <nav className="text-sm text-stone">
        <Link href={`/competitions/${t.slug}`} className="hover:text-accent">
          {t.name}
        </Link>
      </nav>
      <h1 className="mt-2 flex items-center gap-3 font-display text-4xl font-semibold">
        <span className="relative flex size-3" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-bordeaux opacity-60" />
          <span className="relative inline-flex size-3 rounded-full bg-bordeaux" />
        </span>
        {tr("title")}
      </h1>
      {rounds.length ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {rounds.map((r) => (
            <li key={r}>
              <Link
                href={`/competitions/${t.slug}/direct?ronde=${r}`}
                aria-current={r === current ? "page" : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 font-semibold ${r === current ? "border-bordeaux bg-bordeaux text-cream" : "border-line"}`}
              >
                R{r}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-stone">{tr("noRound")}</p>
      )}
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="font-display text-2xl font-semibold">
            {current ? tr("round", { n: current }) : ""}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-line">
            {pairingsTable}
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{tr("standings")}</h2>
          <div className="mt-3">{standingsTable}</div>
        </section>
      </div>
    </div>
  );
}
