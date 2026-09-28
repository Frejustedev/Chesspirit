import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getNextEvent, getLatestResults } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { puzzleOfTheDay, type Puzzle } from "@/lib/puzzles";
import { NAV } from "@/lib/nav";
import { ChessClock } from "@/components/home/chess-clock";
import { getFideRanking } from "@/lib/data/fide";
import { KnightDraw } from "@/components/home/knight-draw";
import { PuzzleBoard } from "@/components/chess/puzzle";
import { PieceSvg, type PieceKind } from "@/components/icons/pieces";
import { IconArrow, IconPin, IconClock } from "@/components/icons";
import { DemoBadge } from "@/components/ui/demo-badge";

/** Les huit rubriques posées sur la rangée de départ : tour, cavalier, fou, dame, roi, fou, cavalier, tour. */
const BACK_RANK: PieceKind[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
const FILES = "abcdefgh";
// Classes écrites en entier pour que Tailwind les génère.
const SQUARE = { light: "bg-square-light", dark: "bg-square-dark" };
const SQUARE_SM = { light: "sm:bg-square-light", dark: "sm:bg-square-dark" };
const SQUARE_LG = { light: "lg:bg-square-light", dark: "lg:bg-square-dark" };
const COORD = { light: "text-square-dark", dark: "text-square-light" };
const COORD_SM = { light: "sm:text-square-dark", dark: "sm:text-square-light" };
const COORD_LG = { light: "lg:text-square-dark", dark: "lg:text-square-light" };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [next, results, stats, top, fide, daily] = await Promise.all([
    getNextEvent(),
    getLatestResults(6),
    supabase.rpc("public_stats").maybeSingle(),
    supabase
      .from("public_ratings")
      .select("*")
      .eq("type", "rapid")
      .order("rating", { ascending: false })
      .limit(5),
    getFideRanking("standard", 5),
    supabase.rpc("daily_puzzle"),
  ]);
  // Même puzzle que l'académie (base de puzzles), repli sur la liste intégrée.
  const dp = daily.data as Tables<"puzzles"> | null;
  const puzzle: Puzzle = dp
    ? {
        id: dp.code,
        fen: dp.fen,
        solution: dp.solution,
        theme: dp.theme as Puzzle["theme"],
        mateIn: dp.mate_in ?? Math.ceil(dp.solution.length / 2),
      }
    : puzzleOfTheDay();
  const figures = (
    [
      ["ratedPlayers", stats.data?.rated_players ?? 0],
      ["tournaments", stats.data?.tournaments ?? 0],
      ["games", stats.data?.games ?? 0],
    ] as const
  ).filter(([, v]) => v > 0);

  const day = next
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "Africa/Porto-Novo" }).format(
        new Date(next.starts_at),
      )
    : "";
  const month = next
    ? new Intl.DateTimeFormat(locale, { month: "short", timeZone: "Africa/Porto-Novo" }).format(
        new Date(next.starts_at),
      )
    : "";

  return (
    <>
      {/* Accueil */}
      <section className="relative overflow-hidden bg-ink text-cream">
        <KnightDraw />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16 lg:px-6 lg:pb-24 lg:pt-24">
          <div className="animate-[rise_700ms_var(--ease-out-soft)_both]">
            <p className="flex items-center gap-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-gold">
              <span aria-hidden className="h-px w-8 bg-gold" />
              {t("welcomeKicker")}
            </p>
            <h1
              className="mt-6 max-w-[15ch] font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.01em] sm:text-6xl lg:text-[5.4rem]"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              {t.rich("welcomeTitle", {
                em: (chunks) => <em className="font-medium italic text-gold-deep">{chunks}</em>,
              })}
            </h1>
            <p className="mt-7 max-w-xl font-serif text-xl leading-snug text-cream/80 sm:text-[1.4rem]">
              {t("welcomeText")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="#portail"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 text-[1.05rem] font-semibold text-onaccent transition-colors hover:bg-gold-deep"
              >
                {t("explore")} <IconArrow className="size-5 rotate-90" />
              </a>
              {next?.status === "registration_open" ? (
                <Link
                  href={`/competitions/${next.slug}/inscription`}
                  className="inline-flex min-h-12 items-center font-semibold text-cream underline decoration-gold decoration-2 underline-offset-[6px] hover:text-gold-deep"
                >
                  {tn("ctaTournament")}
                </Link>
              ) : null}
            </div>
          </div>

          {/* Prochain tournoi, présenté comme un billet */}
          <aside
            className="animate-[rise_900ms_var(--ease-out-soft)_150ms_both]"
            aria-labelledby="next-title"
          >
            {next ? (
              <div className="relative rounded-lg border border-cream/12 bg-paper/95 text-fg shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] backdrop-blur">
                <div className="flex items-stretch">
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-dashed border-line px-3 py-5 text-center sm:w-28">
                    <span className="tabular font-display text-5xl font-semibold leading-none text-gold-deep">
                      {day}
                    </span>
                    <span className="mt-1 font-sans text-sm font-semibold uppercase tracking-[0.18em] text-stone">
                      {month}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 p-5">
                    <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                      {t("nextTournament")}
                    </p>
                    <h2
                      id="next-title"
                      className="mt-1.5 font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]"
                    >
                      <Link href={`/competitions/${next.slug}`} className="hover:text-accent">
                        {next.name}
                      </Link>
                    </h2>
                    <ul className="mt-3 space-y-1 text-[0.98rem] text-stone">
                      <li className="first-letter:uppercase">
                        {formatDate(next.starts_at, locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </li>
                      {next.venue ? (
                        <li className="flex items-center gap-2">
                          <IconPin className="size-4 text-accent" />
                          {next.venue}
                          {next.city ? `, ${next.city}` : ""}
                        </li>
                      ) : null}
                      {next.cadence ? (
                        <li className="flex items-center gap-2">
                          <IconClock className="size-4 text-accent" />
                          {tt(`cadence.${next.cadence}`)}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
                <div className="border-t border-dashed border-line px-5 pb-5 pt-6">
                  <ChessClock
                    target={next.starts_at}
                    compact
                    dateOnly={next.unconfirmed_fields.includes("schedule")}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
                    {next.status === "registration_open" ? (
                      <Link
                        href={`/competitions/${next.slug}/inscription`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bordeaux px-5 font-semibold text-cream transition-colors hover:bg-bordeaux-bright"
                      >
                        {t("register")} <IconArrow className="size-5" />
                      </Link>
                    ) : null}
                    <Link
                      href={`/competitions/${next.slug}`}
                      className="text-sm font-semibold text-accent hover:underline"
                    >
                      {t("seeEvent")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-cream/12 p-6">
                <h2 id="next-title" className="font-display text-2xl font-semibold">
                  {t("nextTournament")}
                </h2>
                <p className="mt-2 font-serif text-lg text-cream/75">{t("noEvent")}</p>
                <Link
                  href="/competitions"
                  className="mt-4 inline-flex items-center gap-2 font-semibold text-gold-deep hover:text-cream"
                >
                  {t("calendar")} <IconArrow className="size-5" />
                </Link>
              </div>
            )}
          </aside>
        </div>

        {results.length ? (
          <div className="relative border-t border-cream/10 bg-ink-soft">
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 lg:px-6">
              <p className="shrink-0 py-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {t("latestResults")}
              </p>
              <div className="group relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
                <ul className="flex w-max animate-[marquee_45s_linear_infinite] gap-10 py-3 group-hover:[animation-play-state:paused]">
                  {[...results, ...results].map((r, i) => (
                    <li
                      key={`${r.tournament.id}-${i}`}
                      className="flex items-center gap-3 whitespace-nowrap text-[0.95rem]"
                      aria-hidden={i >= results.length}
                    >
                      <Link
                        href={`/competitions/${r.tournament.slug}/resultats`}
                        className="font-semibold text-cream hover:text-gold"
                      >
                        {r.tournament.name}
                      </Link>
                      {r.tournament.is_demo ? <DemoBadge dark /> : null}
                      {r.podium.map((p) => (
                        <span key={p.rank} className="text-cream/75">
                          <span className="text-gold">{p.rank}.</span> {p.display_name}{" "}
                          <span className="tabular text-cream/50">{p.points}</span>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Le portail : huit rubriques, huit colonnes */}
      <section
        id="portail"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 lg:px-6 lg:py-24"
        aria-labelledby="portal-title"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-16">
          <div>
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {t("portalKicker")}
            </p>
            <h2
              id="portal-title"
              className="mt-3 font-display text-4xl font-semibold leading-[1.05] lg:text-[3.4rem]"
            >
              {t("portalTitle")}
            </h2>
          </div>
          <p className="max-w-xl font-serif text-xl leading-snug text-stone">{t("portalText")}</p>
        </div>

        <ol className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 lg:grid-cols-8">
          {NAV.map((s, i) => {
            // Damier juste à chaque largeur : 2, 4 puis 8 colonnes.
            const sq = (light: boolean) => (light ? "light" : "dark");
            const tone = [
              sq((i + Math.floor(i / 2)) % 2 === 0),
              sq((i + Math.floor(i / 4)) % 2 === 0),
              sq(i % 2 === 0),
            ] as const;
            return (
              <li key={s.key} className="group relative flex flex-col bg-paper">
                <Link
                  href={s.href}
                  className={`relative flex aspect-[5/4] items-center justify-center transition-[filter] duration-300 group-hover:brightness-110 lg:aspect-square ${SQUARE[tone[0]]} ${SQUARE_SM[tone[1]]} ${SQUARE_LG[tone[2]]}`}
                  aria-label={tn(`sections.${s.key}`)}
                >
                  <PieceSvg
                    kind={BACK_RANK[i] ?? "r"}
                    color={i % 2 === 0 ? "b" : "w"}
                    className="size-16 drop-shadow-[0_6px_8px_rgb(0_0_0/0.25)] transition-transform duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:-translate-y-2 lg:size-[4.5rem]"
                  />
                  <span
                    aria-hidden
                    className={`absolute bottom-1.5 left-2 font-sans text-sm font-bold ${COORD[tone[0]]} ${COORD_SM[tone[1]]} ${COORD_LG[tone[2]]}`}
                  >
                    {FILES[i]}
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    href={s.href}
                    className="font-display text-xl font-semibold leading-tight hover:text-accent"
                  >
                    {tn(`sections.${s.key}`)}
                  </Link>
                  <p className="mt-1.5 text-[0.92rem] leading-snug text-stone">
                    {t(`files.${s.key}`)}
                  </p>
                  <ul className="mt-auto space-y-1 pt-4 text-[0.9rem]">
                    {s.items.slice(1, 3).map((it) => (
                      <li key={it.key}>
                        <Link
                          href={it.href}
                          className="inline-flex min-h-7 items-center gap-1.5 text-fg/85 hover:text-accent"
                        >
                          <span aria-hidden className="text-gold">
                            ›
                          </span>
                          {tn(`items.${it.key}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Aujourd'hui : puzzle et classements */}
      <section className="border-y border-line bg-surface/60" aria-labelledby="today-title">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-20">
          <p className="font-sans text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {t("todayKicker")}
          </p>
          <h2 id="today-title" className="mt-3 font-display text-4xl font-semibold lg:text-5xl">
            {t("todayTitle")}
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold">{t("puzzleTitle")}</h3>
                <Link
                  href="/academie/puzzle-du-jour"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  {t("morePuzzles")}
                </Link>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
                <PuzzleBoard puzzle={puzzle} compact />
              </div>
            </div>
            <div className="space-y-10">
              <TopList
                title={t("top5")}
                href="/classements"
                linkLabel={t("fullRanking")}
                empty={t("rankingEmpty")}
                rows={(top.data ?? []).map((r) => ({
                  key: r.profile_id!,
                  rank: r.rank!,
                  name: r.display_name ?? "",
                  demo: !!r.is_demo,
                  detail: r.club_name,
                  value: r.rating!,
                }))}
              />
              <TopList
                title={t("top5Fide")}
                href="/classements/fide"
                linkLabel={t("fullRanking")}
                empty={t("rankingEmptyFide")}
                rows={fide.rows.map((r) => ({
                  key: r.id,
                  rank: r.rank,
                  name: r.displayName,
                  demo: r.isDemo,
                  detail: r.titles.join(", ") || r.club,
                  value: r.standard!,
                }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Organisateurs, chiffres et partenaires */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-20">
        <div className="grid gap-10 rounded-lg bg-bordeaux p-7 text-cream sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold lg:text-4xl">
              {t("organizersTitle")}
            </h2>
            <p className="mt-3 max-w-2xl font-serif text-xl leading-snug text-cream/85">
              {t("organizersText")}
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-gold-deep hover:text-cream"
            >
              {t("organizersCta")} <IconArrow className="size-5" />
            </Link>
          </div>
          {figures.length ? (
            <div>
              <dl className="grid grid-cols-3 gap-4 border-t border-cream/15 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                {figures.map(([k, v]) => (
                  <div key={k}>
                    <dd className="tabular font-display text-4xl font-semibold text-gold-deep">
                      {v}
                    </dd>
                    <dt className="mt-1 text-sm text-cream/75">{t(`stats.${k}`)}</dt>
                  </div>
                ))}
              </dl>
              {stats.data?.demo ? (
                <p className="mt-3 text-sm text-cream/60">{t("statsDemo")}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-14 text-center font-sans text-sm font-semibold uppercase tracking-[0.2em] text-stone">
          {t("partnersTitle")}
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-14 gap-y-4 font-display text-3xl text-fg/80">
          <li>FSS</li>
          <li aria-hidden className="text-gold">
            ◆
          </li>
          <li>Ayelade Chess</li>
        </ul>
      </section>
    </>
  );
}

/** Tête d'un classement, avec lien vers la liste complète. */
function TopList({
  title,
  href,
  linkLabel,
  empty,
  rows,
}: {
  title: string;
  href: string;
  linkLabel: string;
  empty: string;
  rows: {
    key: string;
    rank: number;
    name: string;
    demo: boolean;
    detail: string | null;
    value: number;
  }[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        <Link href={href} className="text-sm font-semibold text-accent hover:underline">
          {linkLabel}
        </Link>
      </div>
      {rows.length ? (
        <ol className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-4 py-2.5">
              <span className="tabular w-6 text-right font-display text-lg text-accent">
                {r.rank}
              </span>
              <span className="min-w-0 flex-1 font-medium">
                {r.name} {r.demo ? <DemoBadge /> : null}
              </span>
              {r.detail ? (
                <span className="hidden text-sm text-stone sm:inline">{r.detail}</span>
              ) : null}
              <span className="tabular font-semibold">{r.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 font-serif text-lg leading-snug text-stone">{empty}</p>
      )}
    </div>
  );
}
