import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTournaments } from "@/lib/data/tournaments";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("archives");
  return { title: t("title"), description: t("intro") };
}

const PAGE = 30;
/** Nettoie un terme de recherche pour les filtres PostgREST (pas de virgule ni de parenthèse). */
const term = (s?: string) =>
  (s ?? "")
    .replace(/[^\p{L}\p{N} '-]/gu, "")
    .trim()
    .slice(0, 60);

export default async function ArchivesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    joueur?: string;
    ouverture?: string;
    annee?: string;
    resultat?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("archives");
  const supabase = await createClient();
  const player = term(sp.joueur);
  const opening = term(sp.ouverture);
  const year = /^\d{4}$/.test(sp.annee ?? "") ? Number(sp.annee) : null;
  const result = ["1-0", "0-1", "1/2-1/2"].includes(sp.resultat ?? "") ? sp.resultat! : null;
  const page = Math.max(1, Math.min(100, Number(sp.page) || 1));
  let q = supabase
    .from("games")
    .select(
      "id, white_name, black_name, white_rating, black_rating, result, eco, opening, played_on, moves_count, tournaments(name, slug, is_demo)",
      { count: "exact" },
    )
    .order("played_on", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (player) q = q.or(`white_name.ilike.%${player}%,black_name.ilike.%${player}%`);
  if (opening)
    q = /^[A-E]\d\d$/i.test(opening)
      ? q.eq("eco", opening.toUpperCase())
      : q.ilike("opening", `%${opening}%`);
  if (year) q = q.gte("played_on", `${year}-01-01`).lte("played_on", `${year}-12-31`);
  if (result) q = q.eq("result", result);
  const [{ data: games, count }, past] = await Promise.all([
    q,
    listTournaments({ past: true, limit: 12 }),
  ]);
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (p: number) =>
    `/competitions/archives?${new URLSearchParams({
      ...(player ? { joueur: player } : {}),
      ...(opening ? { ouverture: opening } : {}),
      ...(year ? { annee: String(year) } : {}),
      ...(result ? { resultat: result } : {}),
      page: String(p),
    })}`;
  const input = "min-h-11 w-full rounded-md border border-line bg-white px-3";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <Link
        href="/competitions/archives/position"
        className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-cream"
      >
        {t("explorerCta")} →
      </Link>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("games")}</h2>
        <form action="/competitions/archives" className="mt-4 grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label htmlFor="a-p" className="block text-sm font-semibold">
              {t("player")}
            </label>
            <input id="a-p" name="joueur" defaultValue={player} className={input} />
          </div>
          <div>
            <label htmlFor="a-o" className="block text-sm font-semibold">
              {t("opening")}
            </label>
            <input
              id="a-o"
              name="ouverture"
              defaultValue={opening}
              placeholder="B20"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="a-y" className="block text-sm font-semibold">
              {t("year")}
            </label>
            <input
              id="a-y"
              name="annee"
              inputMode="numeric"
              defaultValue={year ?? ""}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="a-r" className="block text-sm font-semibold">
              {t("result")}
            </label>
            <select id="a-r" name="resultat" defaultValue={result ?? ""} className={input}>
              <option value="">{t("anyResult")}</option>
              <option value="1-0">1-0</option>
              <option value="1/2-1/2">½-½</option>
              <option value="0-1">0-1</option>
            </select>
          </div>
          <div className="sm:col-span-5">
            <button
              type="submit"
              className="min-h-11 rounded-full bg-ink px-5 font-semibold text-cream"
            >
              {t("search")}
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm text-stone" aria-live="polite">
          {t("count", { n: count ?? 0 })}
        </p>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {(games ?? []).map((g) => (
            <li key={g.id}>
              <Link
                href={`/parties/${g.id}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 hover:text-bordeaux"
              >
                <span className="min-w-0 flex-1 font-semibold">
                  {g.white_name} {g.white_rating ? `(${g.white_rating})` : ""} – {g.black_name}{" "}
                  {g.black_rating ? `(${g.black_rating})` : ""}
                </span>
                <span className="tabular font-semibold">
                  {g.result === "1/2-1/2" ? "½-½" : g.result}
                </span>
                <span className="w-full text-sm text-stone">
                  {[
                    g.eco,
                    g.opening,
                    g.tournaments?.name,
                    g.played_on ? formatDate(g.played_on, locale) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {g.tournaments?.is_demo ? (
                    <>
                      {" "}
                      <DemoBadge />
                    </>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
          {!games?.length ? <li className="py-3 text-stone">{t("none")}</li> : null}
        </ul>
        {pages > 1 ? (
          <nav aria-label={t("pagination")} className="mt-4 flex items-center gap-3">
            {page > 1 ? (
              <Link
                href={qs(page - 1)}
                className="min-h-11 rounded-full border border-line px-4 py-2 font-semibold"
              >
                ← {t("prev")}
              </Link>
            ) : null}
            <span className="text-sm">{t("page", { page, pages })}</span>
            {page < pages ? (
              <Link
                href={qs(page + 1)}
                className="min-h-11 rounded-full border border-line px-4 py-2 font-semibold"
              >
                {t("next")} →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">{t("pastTournaments")}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {past.map((p) => (
            <li key={p.id}>
              <Link
                href={`/competitions/${p.slug}/resultats`}
                className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
              >
                <span className="font-semibold">
                  {p.name} {p.is_demo ? <DemoBadge /> : null}
                </span>
                <span className="text-sm text-stone">{formatDate(p.starts_at, locale)}</span>
              </Link>
            </li>
          ))}
          {!past.length ? <li className="text-stone">{t("noPast")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
