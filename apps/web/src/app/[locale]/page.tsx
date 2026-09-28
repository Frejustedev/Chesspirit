import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getNextEvent, getLatestResults } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { puzzleOfTheDay, type Puzzle } from "@/lib/puzzles";
import { ChessClock } from "@/components/home/chess-clock";
import { getFideRanking } from "@/lib/data/fide";
import { KnightDraw } from "@/components/home/knight-draw";
import { PuzzleBoard } from "@/components/chess/puzzle";
import { PieceSvg, type PieceKind } from "@/components/icons/pieces";
import { IconArrow, IconCalendar, IconPin, IconClock } from "@/components/icons";
import { DemoBadge } from "@/components/ui/demo-badge";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [next, results, stats, top, fide] = await Promise.all([
    getNextEvent(),
    getLatestResults(6),
    supabase.rpc("public_stats").maybeSingle(),
    supabase
      .from("public_ratings")
      .select("*")
      .eq("type", "rapid")
      .order("rating", { ascending: false })
      .limit(10),
    getFideRanking("standard", 10),
  ]);
  // Même puzzle que l'académie (base de puzzles), repli sur la liste intégrée.
  const daily = (await (await createClient()).rpc("daily_puzzle")).data as Tables<"puzzles"> | null;
  const puzzle: Puzzle = daily
    ? {
        id: daily.code,
        fen: daily.fen,
        solution: daily.solution,
        theme: daily.theme as Puzzle["theme"],
        mateIn: daily.mate_in ?? Math.ceil(daily.solution.length / 2),
      }
    : puzzleOfTheDay();

  const pillars: { key: string; href: string; piece: PieceKind }[] = [
    { key: "coaching", href: "/coaching", piece: "p" },
    { key: "competitions", href: "/competitions", piece: "n" },
    { key: "rankings", href: "/classements", piece: "r" },
    { key: "directory", href: "/annuaire", piece: "b" },
    { key: "shop", href: "/boutique", piece: "q" },
    { key: "media", href: "/media", piece: "k" },
  ];

  return (
    <>
      {/* Bandeau vivant */}
      <section className="relative overflow-hidden bg-ink text-cream">
        <KnightDraw />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:px-6 lg:pb-20 lg:pt-16">
          <div className="animate-[rise_700ms_var(--ease-out-soft)_both]">
            {next ? (
              <>
                <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold">
                  {t("nextEvent")}
                </p>
                <h1
                  className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl"
                  style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
                >
                  {next.name}
                </h1>
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-sans text-[1.02rem] text-cream/85">
                  <li className="flex items-center gap-2">
                    <IconCalendar className="size-5 text-gold" />
                    <span className="first-letter:uppercase">
                      {formatDate(next.starts_at, locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </li>
                  {next.venue ? (
                    <li className="flex items-center gap-2">
                      <IconPin className="size-5 text-gold" />
                      {next.venue}
                      {next.city ? `, ${next.city}` : ""}
                    </li>
                  ) : null}
                  {next.cadence ? (
                    <li className="flex items-center gap-2">
                      <IconClock className="size-5 text-gold" />
                      {tt(`cadence.${next.cadence}`)}
                    </li>
                  ) : null}
                </ul>
                <div className="mt-9">
                  <ChessClock
                    target={next.starts_at}
                    dateOnly={next.unconfirmed_fields.includes("schedule")}
                  />
                </div>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  {next.status === "registration_open" ? (
                    <Link
                      href={`/competitions/${next.slug}/inscription`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 text-[1.05rem] font-semibold text-onaccent transition-colors hover:bg-accent"
                    >
                      {t("register")} <IconArrow className="size-5" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/competitions/${next.slug}`}
                    className="inline-flex min-h-12 items-center font-semibold text-cream underline decoration-gold decoration-2 underline-offset-4 hover:text-gold"
                  >
                    {t("seeEvent")}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold">
                  {t("kicker")}
                </p>
                <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02] lg:text-7xl">
                  {t("fallbackTitle")}
                </h1>
                <p className="mt-5 max-w-xl font-serif text-xl text-cream/80">
                  {t("fallbackText")}
                </p>
              </>
            )}
          </div>

          <aside
            className="animate-[rise_900ms_var(--ease-out-soft)_120ms_both] rounded-lg bg-paper p-4 text-fg shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:p-5 lg:self-start"
            aria-labelledby="puzzle-title"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="puzzle-title" className="font-display text-2xl font-semibold">
                {t("puzzleTitle")}
              </h2>
              <Link
                href="/academie/puzzle-du-jour"
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t("morePuzzles")}
              </Link>
            </div>
            <PuzzleBoard puzzle={puzzle} compact />
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

      {/* Piliers */}
      <section
        className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-24"
        aria-labelledby="pillars-title"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              {t("ecosystemKicker")}
            </p>
            <h2 id="pillars-title" className="mt-3 font-display text-4xl font-semibold lg:text-5xl">
              {t("ecosystemTitle")}
            </h2>
            <p className="mt-4 max-w-md font-serif text-xl leading-snug text-stone">
              {t("ecosystemText")}
            </p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {pillars.map((p, i) => (
              <li key={p.key}>
                <Link
                  href={p.href}
                  className="group grid grid-cols-[2.5rem_3rem_1fr_auto] items-center gap-3 py-4 sm:grid-cols-[3rem_3.5rem_1fr_auto] sm:gap-5"
                >
                  <span className="tabular font-sans text-sm font-semibold text-stone">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <PieceSvg
                    kind={p.piece}
                    color="w"
                    className="size-11 transition-transform duration-300 group-hover:-translate-y-1 sm:size-12"
                  />
                  <span>
                    <span className="block font-display text-2xl font-semibold group-hover:text-accent">
                      {t(`pillars.${p.key}.title`)}
                    </span>
                    <span className="block text-[0.98rem] text-stone">
                      {t(`pillars.${p.key}.text`)}
                    </span>
                  </span>
                  <IconArrow className="size-5 text-stone transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Classements (cote Chesspirit et Elo FIDE officiel) et chiffres */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t("rankingsTitle")}</h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <TopList
              title={t("top10")}
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
              title={t("top10Fide")}
              href="/classements/fide"
              linkLabel={t("fullFide")}
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
          <div className="mt-14 grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold">{t("figures")}</h2>
              <dl className="mt-5 grid grid-cols-3 gap-3">
                {(
                  [
                    ["ratedPlayers", stats.data?.rated_players],
                    ["tournaments", stats.data?.tournaments],
                    ["games", stats.data?.games],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-[var(--radius-card)] border border-line bg-paper p-4"
                  >
                    <dt className="text-sm text-stone">{t(`stats.${k}`)}</dt>
                    <dd className="tabular mt-1 font-display text-4xl font-semibold">{v ?? 0}</dd>
                  </div>
                ))}
              </dl>
              {stats.data?.demo ? (
                <p className="mt-2 text-sm text-stone">{t("statsDemo")}</p>
              ) : null}
            </div>
            <div className="self-start rounded-[var(--radius-card)] bg-bordeaux p-6 text-cream">
              <h3 className="font-display text-2xl font-semibold">{t("organizersTitle")}</h3>
              <p className="mt-2 font-serif text-lg text-cream/85">{t("organizersText")}</p>
              <Link
                href="/contact"
                className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-gold hover:text-cream"
              >
                {t("organizersCta")} <IconArrow className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Partenaires */}
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <p className="text-center font-sans text-sm font-semibold uppercase tracking-[0.18em] text-stone">
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

/** Top 10 d'un classement, avec lien vers la liste complète. */
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        <Link href={href} className="text-sm font-semibold text-accent hover:underline">
          {linkLabel}
        </Link>
      </div>
      {rows.length ? (
        <ol className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-4 px-4 py-2.5">
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
        <p className="mt-4 rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-6 font-serif text-lg text-stone">
          {empty}
        </p>
      )}
    </div>
  );
}
