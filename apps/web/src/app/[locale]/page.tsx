import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getNextEvent, getLatestResults } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import { puzzleOfTheDay } from "@/lib/puzzles";
import { ChessClock } from "@/components/home/chess-clock";
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
  const [next, results, stats, top] = await Promise.all([
    getNextEvent(),
    getLatestResults(6),
    supabase.rpc("public_stats").maybeSingle(),
    supabase.from("public_ratings").select("*").eq("type", "rapid").order("rating", { ascending: false }).limit(10),
  ]);
  const puzzle = puzzleOfTheDay();

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
                <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold">{t("nextEvent")}</p>
                <h1 className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}>
                  {next.name}
                </h1>
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-sans text-[1.02rem] text-cream/85">
                  <li className="flex items-center gap-2">
                    <IconCalendar className="size-5 text-gold" />
                    <span className="first-letter:uppercase">{formatDate(next.starts_at, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
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
                  <ChessClock target={next.starts_at} />
                </div>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  {next.status === "registration_open" ? (
                    <Link
                      href={`/competitions/${next.slug}/inscription`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 text-[1.05rem] font-semibold text-ink transition-colors hover:bg-cream"
                    >
                      {t("register")} <IconArrow className="size-5" />
                    </Link>
                  ) : null}
                  <Link href={`/competitions/${next.slug}`} className="inline-flex min-h-12 items-center font-semibold text-cream underline decoration-gold decoration-2 underline-offset-4 hover:text-gold">
                    {t("seeEvent")}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold">{t("kicker")}</p>
                <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02] lg:text-7xl">{t("fallbackTitle")}</h1>
                <p className="mt-5 max-w-xl font-serif text-xl text-cream/80">{t("fallbackText")}</p>
              </>
            )}
          </div>

          <aside className="animate-[rise_900ms_var(--ease-out-soft)_120ms_both] rounded-lg bg-paper p-4 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:p-5 lg:self-start" aria-labelledby="puzzle-title">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="puzzle-title" className="font-display text-2xl font-semibold">
                {t("puzzleTitle")}
              </h2>
              <Link href="/academie/puzzle-du-jour" className="text-sm font-semibold text-bordeaux hover:underline">
                {t("morePuzzles")}
              </Link>
            </div>
            <PuzzleBoard puzzle={puzzle} compact />
          </aside>
        </div>

        {results.length ? (
          <div className="relative border-t border-cream/10 bg-ink-soft">
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 lg:px-6">
              <p className="shrink-0 py-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">{t("latestResults")}</p>
              <div className="group relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
                <ul className="flex w-max animate-[marquee_45s_linear_infinite] gap-10 py-3 group-hover:[animation-play-state:paused]">
                  {[...results, ...results].map((r, i) => (
                    <li key={`${r.tournament.id}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-[0.95rem]" aria-hidden={i >= results.length}>
                      <Link href={`/competitions/${r.tournament.slug}/resultats`} className="font-semibold text-cream hover:text-gold">
                        {r.tournament.name}
                      </Link>
                      {r.tournament.is_demo ? <DemoBadge dark /> : null}
                      {r.podium.map((p) => (
                        <span key={p.rank} className="text-cream/75">
                          <span className="text-gold">{p.rank}.</span> {p.display_name} <span className="tabular text-cream/50">{p.points}</span>
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
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-24" aria-labelledby="pillars-title">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">{t("ecosystemKicker")}</p>
            <h2 id="pillars-title" className="mt-3 font-display text-4xl font-semibold lg:text-5xl">
              {t("ecosystemTitle")}
            </h2>
            <p className="mt-4 max-w-md font-serif text-xl leading-snug text-stone">{t("ecosystemText")}</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {pillars.map((p, i) => (
              <li key={p.key}>
                <Link href={p.href} className="group grid grid-cols-[2.5rem_3rem_1fr_auto] items-center gap-3 py-4 sm:grid-cols-[3rem_3.5rem_1fr_auto] sm:gap-5">
                  <span className="tabular font-sans text-sm font-semibold text-stone">{String(i + 1).padStart(2, "0")}</span>
                  <PieceSvg kind={p.piece} color={i % 2 ? "b" : "w"} className="size-11 transition-transform duration-300 group-hover:-translate-y-1 sm:size-12" />
                  <span>
                    <span className="block font-display text-2xl font-semibold group-hover:text-bordeaux">{t(`pillars.${p.key}.title`)}</span>
                    <span className="block text-[0.98rem] text-stone">{t(`pillars.${p.key}.text`)}</span>
                  </span>
                  <IconArrow className="size-5 text-stone transition-transform group-hover:translate-x-1 group-hover:text-bordeaux" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Classement et chiffres */}
      <section className="border-y border-line bg-cream/60">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-2 lg:px-6">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-3xl font-semibold">{t("top10")}</h2>
              <Link href="/classements" className="text-sm font-semibold text-bordeaux hover:underline">
                {t("fullRanking")}
              </Link>
            </div>
            {top.data?.length ? (
              <ol className="mt-5 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
                {top.data.map((r) => (
                  <li key={r.profile_id} className="flex items-center gap-4 px-4 py-2.5">
                    <span className="tabular w-6 text-right font-display text-lg text-gold-deep">{r.rank}</span>
                    <span className="flex-1 font-medium">
                      {r.display_name} {r.is_demo ? <DemoBadge /> : null}
                    </span>
                    <span className="hidden text-sm text-stone sm:inline">{r.club_name}</span>
                    <span className="tabular font-semibold">{r.rating}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-6 font-serif text-lg text-stone">{t("rankingEmpty")}</p>
            )}
          </div>
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
                <div key={k} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
                  <dt className="text-sm text-stone">{t(`stats.${k}`)}</dt>
                  <dd className="tabular mt-1 font-display text-4xl font-semibold">{v ?? 0}</dd>
                </div>
              ))}
            </dl>
            {stats.data?.demo ? <p className="mt-2 text-sm text-stone">{t("statsDemo")}</p> : null}
            <div className="mt-8 rounded-[var(--radius-card)] bg-bordeaux p-6 text-cream">
              <h3 className="font-display text-2xl font-semibold">{t("organizersTitle")}</h3>
              <p className="mt-2 font-serif text-lg text-cream/85">{t("organizersText")}</p>
              <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-gold hover:text-cream">
                {t("organizersCta")} <IconArrow className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Partenaires */}
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <p className="text-center font-sans text-sm font-semibold uppercase tracking-[0.18em] text-stone">{t("partnersTitle")}</p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-14 gap-y-4 font-display text-3xl text-ink/80">
          <li>FSS</li>
          <li aria-hidden className="text-gold">◆</li>
          <li>Ayelade Chess</li>
        </ul>
      </section>
    </>
  );
}
