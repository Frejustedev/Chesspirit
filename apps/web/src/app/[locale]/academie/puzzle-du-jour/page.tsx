import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { getSession } from "@/lib/auth";
import { tr } from "@/lib/i18n-json";
import { puzzleOfTheDay, type Puzzle } from "@/lib/puzzles";
import { AcademyNav } from "@/components/content/academy-nav";
import { TrackedPuzzle } from "@/components/content/academy-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academy");
  return { title: t("nav.puzzle") };
}

const asPuzzle = (p: {
  code: string;
  fen: string;
  solution: string[];
  theme: string;
  mate_in: number | null;
}): Puzzle => ({
  id: p.code,
  fen: p.fen,
  solution: p.solution,
  theme: p.theme as Puzzle["theme"],
  mateIn: p.mate_in ?? Math.ceil(p.solution.length / 2),
});

export default async function DailyPuzzlePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("academy");
  const session = await getSession();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(
    new Date(),
  );
  const [{ data: dailyRaw }, { data: challenge }, streak] = await Promise.all([
    supabase.rpc("daily_puzzle"),
    supabase
      .from("weekly_challenges")
      .select("id, title, week_start, puzzle_ids")
      .lte("week_start", today)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    session?.profile
      ? supabase
          .from("puzzle_attempts")
          .select("attempted_on, solved")
          .eq("profile_id", session.profile.id)
          .eq("context", "daily")
          .order("attempted_on", { ascending: false })
          .limit(60)
          .then((r) => {
            // Série : jours consécutifs résolus jusqu'à aujourd'hui (ou hier).
            let n = 0;
            let expected = new Date(`${today}T00:00:00Z`);
            for (const a of r.data ?? []) {
              const d = new Date(`${a.attempted_on}T00:00:00Z`);
              if (n === 0 && d.getTime() === expected.getTime() - 86400000) expected = d;
              if (d.getTime() !== expected.getTime() || !a.solved) break;
              n += 1;
              expected = new Date(expected.getTime() - 86400000);
            }
            return n;
          })
      : Promise.resolve(null),
  ]);
  const daily = dailyRaw as Tables<"puzzles"> | null;
  const { data: challengePuzzles } = challenge
    ? await supabase
        .from("puzzles")
        .select("id, code, fen, solution, theme, mate_in")
        .in("id", challenge.puzzle_ids)
    : { data: [] };
  const { data: leaders } = challenge
    ? await supabase.rpc("challenge_leaderboard", { p_challenge: challenge.id })
    : { data: [] };
  const puzzle = daily ? asPuzzle(daily) : puzzleOfTheDay();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("nav.puzzle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">
        {t("puzzleIntro", { date: formatDate(today, locale) })}
      </p>
      <div className="mt-6">
        <AcademyNav current="/academie/puzzle-du-jour" />
      </div>
      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,28rem)_1fr]">
        <div>
          {daily ? (
            <TrackedPuzzle
              id={daily.id}
              puzzle={puzzle}
              context="daily"
              signedIn={!!session?.profile}
            />
          ) : null}
        </div>
        <aside className="space-y-4">
          <p className="rounded-lg bg-cream p-4">
            {session?.profile ? t("streak", { n: streak ?? 0 }) : t("signInForStreak")}
          </p>
          <p className="text-sm text-stone">{t("mateIn", { n: puzzle.mateIn })}</p>
        </aside>
      </div>
      {challenge ? (
        <section className="mt-14">
          <h2 className="font-display text-3xl font-semibold">{tr(challenge.title, locale)}</h2>
          <p className="mt-1 text-stone">
            {t("challengeWeek", { date: formatDate(challenge.week_start, locale) })}
          </p>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            {(challengePuzzles ?? []).map((p) => (
              <TrackedPuzzle
                key={p.id}
                id={p.id}
                puzzle={asPuzzle(p)}
                context="challenge"
                signedIn={!!session?.profile}
              />
            ))}
          </div>
          <h3 className="mt-8 font-semibold">{t("leaderboard")}</h3>
          {leaders?.length ? (
            <ol className="mt-2 space-y-1">
              {leaders.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tabular w-6 text-stone">{i + 1}</span>
                  <span className="min-w-0 flex-1">{l.display_name}</span>
                  <span className="tabular font-semibold">{Number(l.solved)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-stone">{t("noLeaders")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
