import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myGames } from "@/lib/data/me";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { RatingChart } from "@/components/charts/rating-chart";

export const metadata: Metadata = { robots: { index: false } };

type Tally = { w: number; d: number; l: number };
const add = (t: Tally, s: number | null) => {
  if (s === 1) t.w++;
  else if (s === 0.5) t.d++;
  else if (s === 0) t.l++;
};
const pct = (t: Tally) => {
  const n = t.w + t.d + t.l;
  return n ? Math.round(((t.w + t.d / 2) / n) * 100) : 0;
};

function Bar({ t, label }: { t: Tally; label: string }) {
  const n = t.w + t.d + t.l || 1;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-stone">
          +{t.w} ={t.d} −{t.l} · {pct(t)} %
        </span>
      </div>
      <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="bg-success" style={{ width: `${(t.w / n) * 100}%` }} />
        <span className="bg-gold" style={{ width: `${(t.d / n) * 100}%` }} />
        <span className="bg-danger" style={{ width: `${(t.l / n) * 100}%` }} />
      </div>
    </div>
  );
}

export default async function MyStats({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/statistiques");
  const t = await getTranslations("myStats");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [games, { data: history }] = await Promise.all([
    myGames(session, {}, 5000),
    supabase
      .from("rating_history")
      .select("type, rating_after, effective_on")
      .eq("profile_id", session.profile!.id)
      .order("effective_on"),
  ]);
  const white: Tally = { w: 0, d: 0, l: 0 };
  const black: Tally = { w: 0, d: 0, l: 0 };
  const openings = new Map<string, Tally>();
  const opponents = new Map<string, Tally>();
  for (const g of games) {
    add(g.white ? white : black, g.score);
    const o = g.eco ? `${g.eco}${g.opening ? ` ${g.opening}` : ""}` : t("unclassified");
    openings.set(o, openings.get(o) ?? { w: 0, d: 0, l: 0 });
    add(openings.get(o)!, g.score);
    opponents.set(g.opponent, opponents.get(g.opponent) ?? { w: 0, d: 0, l: 0 });
    add(opponents.get(g.opponent)!, g.score);
  }
  const top = (m: Map<string, Tally>) =>
    [...m.entries()]
      .sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l))
      .slice(0, 8);
  const curves = (["rapid", "blitz", "classical"] as const)
    .map((k) => ({
      k,
      points: (history ?? [])
        .filter((h) => h.type === k)
        .map((h) => ({ date: h.effective_on, rating: h.rating_after })),
    }))
    .filter((c) => c.points.length > 1);

  return (
    <AccountShell
      nav={<AccountNav current="/compte/statistiques" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      {!games.length ? <p className="text-stone">{t("none")}</p> : null}
      {curves.map((c) => (
        <section key={c.k} className="mb-8">
          <h2 className="font-display text-2xl font-semibold">
            {t("curve", { cadence: tt(`cadence.${c.k}`) })}
          </h2>
          <div className="mt-3 rounded-[var(--radius-card)] border border-line p-3">
            <RatingChart points={c.points} label={t("curve", { cadence: tt(`cadence.${c.k}`) })} />
          </div>
        </section>
      ))}
      {games.length ? (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-2xl font-semibold">{t("byColor")}</h2>
            <div className="mt-4 space-y-4">
              <Bar t={white} label={t("white")} />
              <Bar t={black} label={t("black")} />
            </div>
          </section>
          <section>
            <h2 className="font-display text-2xl font-semibold">{t("openings")}</h2>
            <div className="mt-4 space-y-3">
              {top(openings).map(([k, v]) => (
                <Bar key={k} t={v} label={k} />
              ))}
            </div>
          </section>
          <section className="lg:col-span-2">
            <h2 className="font-display text-2xl font-semibold">{t("opponents")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {top(opponents).map(([k, v]) => (
                <Bar key={k} t={v} label={k} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AccountShell>
  );
}
