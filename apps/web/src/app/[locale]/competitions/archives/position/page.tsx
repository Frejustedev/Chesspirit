import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Chess } from "chess.js";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { fenKey } from "@/lib/fen-key";
import { ExplorerBoard } from "@/components/archives/explorer-board";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("archives");
  return { title: t("explorerTitle"), description: t("explorerIntro") };
}

/** Rejoue la position demandée : FEN de départ facultative puis coups en notation algébrique. */
function resolve(fenParam?: string, coups?: string) {
  let base: string | null = null;
  let chess = new Chess();
  let error = false;
  if (fenParam && fenKey(fenParam)) {
    try {
      chess = new Chess(fenParam);
      base = fenParam;
    } catch {
      error = true;
    }
  } else if (fenParam) error = true;
  const moves: string[] = [];
  for (const san of (coups ?? "").split(/\s+/).filter(Boolean).slice(0, 200)) {
    try {
      moves.push(chess.move(san).san);
    } catch {
      error = true;
      break;
    }
  }
  return { fen: chess.fen(), base, moves, error };
}

export default async function ExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fen?: string; coups?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("archives");
  const { fen, base, moves, error } = resolve(sp.fen?.slice(0, 120), sp.coups?.slice(0, 2000));
  const key = fenKey(fen)!;
  const supabase = await createClient();
  const [{ data: stats }, { data: hits }] = await Promise.all([
    supabase.rpc("position_explorer", { p_fen_key: key }),
    supabase
      .from("game_positions")
      .select(
        "game_id, games(id, white_name, black_name, result, played_on, eco, tournaments(name))",
      )
      .eq("fen_key", key)
      .limit(60),
  ]);
  const games = [
    ...new Map((hits ?? []).filter((h) => h.games).map((h) => [h.game_id, h.games!])).values(),
  ];
  const withMove = (san: string) => {
    const p = new URLSearchParams();
    if (base) p.set("fen", base);
    p.set("coups", [...moves, san].join(" "));
    return `/competitions/archives/position?${p}`;
  };
  const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
  const line: string[] = [];
  moves.forEach((m, i) => {
    const white = base ? base.split(" ")[1] === "w" : true;
    const moveNo = Math.floor(i / 2) + 1;
    line.push(i % 2 === 0 ? `${moveNo}.${white ? "" : ".."} ${m}` : m);
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <Link
        href="/competitions/archives"
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← {t("title")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("explorerTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("explorerIntro")}</p>
      {error ? (
        <p role="alert" className="mt-4 font-semibold text-accent">
          {t("invalidPosition")}
        </p>
      ) : null}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,30rem)_1fr]">
        <div>
          <ExplorerBoard fen={fen} moves={moves} base={base} />
          <p className="mt-3 font-mono text-sm" aria-label={t("line")}>
            {line.join(" ") || t("startPosition")}
          </p>
          <form action="/competitions/archives/position" className="mt-6">
            <label htmlFor="x-fen" className="block text-sm font-semibold">
              {t("fenLabel")}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="x-fen"
                name="fen"
                defaultValue={base ?? ""}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 font-mono text-sm"
              />
              <button
                type="submit"
                className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
              >
                {t("search")}
              </button>
            </div>
          </form>
        </div>
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="font-display text-2xl font-semibold">{t("nextMoves")}</h2>
            {stats?.length ? (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2">{t("move")}</th>
                    <th className="py-2 text-right">{t("gamesCol")}</th>
                    <th className="py-2 pl-4">{t("results")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const n = Number(s.games);
                    const w = pct(Number(s.white_wins), n);
                    const d = pct(Number(s.draws), n);
                    return (
                      <tr key={s.next_san} className="border-b border-line">
                        <td className="py-2">
                          <Link
                            href={withMove(s.next_san)}
                            className="font-mono font-semibold text-accent hover:underline"
                          >
                            {s.next_san}
                          </Link>
                        </td>
                        <td className="tabular py-2 text-right">{n}</td>
                        <td className="py-2 pl-4">
                          <span
                            className="flex h-3 overflow-hidden rounded-full border border-line"
                            role="img"
                            aria-label={t("split", { w, d, b: 100 - w - d })}
                          >
                            <span className="bg-paper" style={{ width: `${w}%` }} />
                            <span className="bg-stone/50" style={{ width: `${d}%` }} />
                            <span className="bg-ink" style={{ width: `${100 - w - d}%` }} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-stone">{t("noNext")}</p>
            )}
          </section>
          <section>
            <h2 className="font-display text-2xl font-semibold">
              {t("reachedIn", { n: games.length })}
            </h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {games.slice(0, 30).map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/parties/${g.id}`}
                    className="flex flex-wrap gap-x-3 py-2 hover:text-accent"
                  >
                    <span className="min-w-0 flex-1 font-semibold">
                      {g.white_name} – {g.black_name}
                    </span>
                    <span className="tabular">{g.result === "1/2-1/2" ? "½-½" : g.result}</span>
                    <span className="w-full text-sm text-stone">
                      {[
                        g.eco,
                        g.tournaments?.name,
                        g.played_on ? formatDate(g.played_on, locale) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
              {!games.length ? <li className="py-2 text-stone">{t("noGames")}</li> : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
