import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { PredictButtons } from "@/components/community/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.predictions");
  return { title: t("title"), description: t("intro") };
}

const WINDOW_MS = 15 * 60_000;
const windowStart = () => new Date(Date.now() - WINDOW_MS).toISOString();

export default async function PredictionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.predictions");
  const supabase = await createClient();
  const session = await getSession();
  const me = session?.profile ?? null;
  const since = windowStart();
  const [{ data: rounds }, { data: board }, { data: mine }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, number, published_at, tournament_id, tournaments(name, slug)")
      .gt("published_at", since)
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("prediction_leaderboard")
      .select("*")
      .order("points", { ascending: false })
      .limit(20),
    me
      ? supabase
          .from("predictions")
          .select("pairing_id, predicted, points, created_at")
          .eq("profile_id", me.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({
          data: [] as {
            pairing_id: string;
            predicted: string;
            points: number;
            created_at: string;
          }[],
        }),
  ]);
  const open = await Promise.all(
    (rounds ?? []).map(async (r) => {
      const { data } = await supabase
        .from("public_pairings")
        .select("id, board, white_name, black_name, white_id, black_id")
        .eq("tournament_id", r.tournament_id)
        .eq("round_number", r.number)
        .is("result", null)
        .not("black_id", "is", null)
        .order("board");
      return { round: r, pairings: data ?? [] };
    }),
  );
  const pick = new Map((mine ?? []).map((p) => [p.pairing_id, p.predicted]));
  const hasOpen = open.some((o) => o.pairings.length);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/pronostics" />
      </CommunityHeader>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("open")}</h2>
          <p className="mt-1 text-sm text-stone">{t("rules")}</p>
          {!hasOpen ? <p className="mt-4 text-stone">{t("noneOpen")}</p> : null}
          {open
            .filter((o) => o.pairings.length)
            .map(({ round, pairings }) => (
              <div key={round.id} className="mt-6">
                <h3 className="font-semibold">
                  <Link
                    href={`/competitions/${round.tournaments?.slug}`}
                    className="hover:text-accent"
                  >
                    {round.tournaments?.name}
                  </Link>{" "}
                  · {t("round", { n: round.number })}
                </h3>
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {pairings.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="tabular text-sm text-stone">
                          {t("board", { n: p.board ?? 0 })}
                        </span>{" "}
                        <strong>{p.white_name}</strong> – <strong>{p.black_name}</strong>
                      </span>
                      {me && me.id !== p.white_id && me.id !== p.black_id ? (
                        <PredictButtons
                          pairingId={p.id!}
                          current={pick.get(p.id!) ?? null}
                          board={p.board ?? 0}
                        />
                      ) : !me ? (
                        <Link
                          href={`/connexion?next=${encodeURIComponent("/communaute/pronostics")}`}
                          className="text-sm font-semibold text-accent"
                        >
                          {t("signIn")}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {me ? (
            <p className="mt-8 font-semibold">
              {t("myScore", {
                points: (mine ?? []).reduce((s, p) => s + p.points, 0),
                n: mine?.length ?? 0,
              })}
            </p>
          ) : null}
        </section>
        <aside>
          <h2 className="font-display text-2xl font-semibold">{t("leaderboard")}</h2>
          {board?.length ? (
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {board.map((b, i) => (
                <li key={b.profile_id} className="flex gap-3 py-2">
                  <span className="tabular w-6 text-stone">{i + 1}</span>
                  <span className="min-w-0 flex-1">{b.display_name}</span>
                  <span className="tabular font-semibold">
                    {t("points", { n: Number(b.points ?? 0) })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-stone">{t("emptyBoard")}</p>
          )}
          <p className="mt-4 text-sm text-stone">{t("free")}</p>
        </aside>
      </div>
    </div>
  );
}
