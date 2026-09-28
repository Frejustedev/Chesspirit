import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { PvmControls, PvmVoteBoard } from "@/components/community/actions";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("pvm_games").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = await load(slug);
  return g ? { title: tr(g.title, locale) } : {};
}

export default async function PvmGame({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const g = await load(slug);
  if (!g) notFound();
  const t = await getTranslations("community.pvm");
  const supabase = await createClient();
  const session = await getSession();
  const me = session?.profile ?? null;
  const ply = g.moves.length;
  const [{ data: tally }, { data: myVote }] = await Promise.all([
    supabase.rpc("pvm_tally", { p_game: g.id }),
    me
      ? supabase
          .from("pvm_votes")
          .select("move")
          .eq("game_id", g.id)
          .eq("ply", ply)
          .eq("profile_id", me.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const publicToMove = g.fen.split(" ")[1] === g.public_color;
  const voteOpen =
    g.status === "open" &&
    publicToMove &&
    (!g.vote_ends_at || new Date(g.vote_ends_at) > new Date());
  const canControl =
    !!session &&
    (isAdminRole(session.roles) || (!!g.master_profile_id && g.master_profile_id === me?.id));
  const total = (tally ?? []).reduce((s, x) => s + Number(x.votes), 0);
  const pairs: string[] = [];
  for (let i = 0; i < g.moves.length; i += 2)
    pairs.push(`${i / 2 + 1}. ${g.moves[i]}${g.moves[i + 1] ? ` ${g.moves[i + 1]}` : ""}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <Link
        href="/communaute/public-contre-le-maitre"
        className="text-sm font-semibold text-bordeaux hover:underline"
      >
        ← {t("title")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {tr(g.title, locale)}
      </h1>
      <p className="mt-2 text-stone">
        {t("master", { name: g.master_name })} ·{" "}
        {t("publicPlays", { color: t(g.public_color === "w" ? "white" : "black") })}
        {g.is_demo ? ` · ${t("demo")}` : ""}
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,32rem)_1fr]">
        <div>
          <PvmVoteBoard
            gameId={g.id}
            fen={g.fen}
            orientation={g.public_color as "w" | "b"}
            canVote={voteOpen && !!me}
            myVote={myVote?.move ?? null}
          />
        </div>
        <div className="space-y-6">
          <p className="rounded-lg bg-cream p-4 font-semibold" aria-live="polite">
            {g.status === "finished"
              ? t("finished", { result: g.result ?? "—" })
              : publicToMove
                ? voteOpen
                  ? me
                    ? t("yourTurn")
                    : t("signInToVote")
                  : t("voteClosed")
                : t("masterTurn")}
            {voteOpen && g.vote_ends_at ? (
              <span className="mt-1 block text-sm font-normal">
                {t("voteEnds", { date: formatDateTime(g.vote_ends_at, locale) })}
              </span>
            ) : null}
          </p>
          {!me && voteOpen ? (
            <Link
              href={`/connexion?next=${encodeURIComponent(`/communaute/public-contre-le-maitre/${g.slug}`)}`}
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-cream"
            >
              {t("signIn")}
            </Link>
          ) : null}
          {publicToMove && g.status === "open" ? (
            <section>
              <h2 className="font-display text-xl font-semibold">{t("tally")}</h2>
              {tally?.length ? (
                <ul className="mt-2 space-y-2">
                  {tally.map((x) => {
                    const pct = total ? Math.round((Number(x.votes) / total) * 100) : 0;
                    return (
                      <li key={x.move}>
                        <div className="flex justify-between text-sm">
                          <span className="font-mono font-semibold">{x.move}</span>
                          <span className="tabular">
                            {t("votes", { n: Number(x.votes) })} · {pct} %
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream">
                          <div className="h-full bg-bordeaux" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone">{t("noVotes")}</p>
              )}
            </section>
          ) : null}
          <section>
            <h2 className="font-display text-xl font-semibold">{t("movesTitle")}</h2>
            <p className="mt-2 font-mono text-sm">{pairs.join("  ") || "—"}</p>
          </section>
          {canControl && g.status === "open" ? (
            <PvmControls gameId={g.id} publicToMove={publicToMove} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
