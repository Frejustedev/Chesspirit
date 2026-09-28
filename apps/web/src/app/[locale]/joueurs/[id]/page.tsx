import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { RatingChart } from "@/components/charts/rating-chart";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PieceSvg } from "@/components/icons/pieces";

type Props = { params: Promise<{ locale: string; id: string }> };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("public_profiles").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id);
  return p ? { title: p.display_name ?? "" } : { robots: { index: false } };
}

/** Fiche publique d'un joueur (uniquement s'il a accepté un profil public). */
export default async function PlayerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const p = await load(id);
  if (!p) notFound();
  const t = await getTranslations("player");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const [{ data: ratings }, { data: history }, { data: results }, { data: games }] =
    await Promise.all([
      supabase
        .from("ratings")
        .select("type, rating, games, provisional, peak")
        .eq("profile_id", id),
      supabase
        .from("rating_history")
        .select("type, rating_after, effective_on")
        .eq("profile_id", id)
        .order("effective_on"),
      supabase
        .from("public_standings")
        .select("tournament_id, rank, points, rating_delta")
        .eq("player_id", id),
      supabase
        .from("games")
        .select("id, white_name, black_name, result, played_on, white_id")
        .or(`white_id.eq.${id},black_id.eq.${id}`)
        .order("played_on", { ascending: false })
        .limit(10),
    ]);
  const tIds = (results ?? []).map((r) => r.tournament_id!);
  const { data: tours } = tIds.length
    ? await supabase.from("tournaments").select("id, name, slug, starts_at").in("id", tIds)
    : { data: [] };
  const byT = new Map((tours ?? []).map((x) => [x.id, x]));
  const main = (ratings ?? []).find((r) => r.type === "rapid") ?? ratings?.[0];
  const curve = (history ?? [])
    .filter((h) => h.type === (main?.type ?? "rapid"))
    .map((h) => ({ date: h.effective_on, rating: h.rating_after }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex items-start gap-4">
        <PieceSvg kind="p" color="w" className="size-16 shrink-0" />
        <div>
          <h1 className="font-display text-4xl font-semibold">
            {p.titles?.length ? (
              <span className="mr-2 text-2xl text-bordeaux">{p.titles.join(" ")}</span>
            ) : null}
            {p.display_name} {p.is_demo ? <DemoBadge /> : null}
          </h1>
          <p className="mt-1 text-stone">
            {[p.club_name, p.city, p.fide_id ? `FIDE ${p.fide_id}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-3 gap-3">
        {(["rapid", "blitz", "classical"] as const).map((k) => {
          const r = ratings?.find((x) => x.type === k);
          return (
            <div key={k} className="rounded-[var(--radius-card)] border border-line p-3">
              <dt className="text-sm text-stone">{tt(`cadence.${k}`)}</dt>
              <dd className="tabular font-display text-3xl font-semibold">
                {r && !r.provisional ? r.rating : "—"}
              </dd>
              {r?.peak ? (
                <dd className="text-xs text-stone">{t("peak", { peak: r.peak })}</dd>
              ) : null}
            </div>
          );
        })}
      </dl>
      {curve.length > 1 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            {t("curve", {
              cadence: tt(`cadence.${main?.type === "online" ? "rapid" : (main?.type ?? "rapid")}`),
            })}
          </h2>
          <div className="mt-3 rounded-[var(--radius-card)] border border-line p-3">
            <RatingChart points={curve} label={t("curveLabel")} />
          </div>
        </section>
      ) : null}
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("tournaments")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {(results ?? [])
              .map((r) => ({ ...r, t: byT.get(r.tournament_id!) }))
              .sort((a, b) => (b.t?.starts_at ?? "").localeCompare(a.t?.starts_at ?? ""))
              .map((r) => (
                <li key={r.tournament_id} className="flex items-center gap-3 py-2">
                  <Link
                    href={`/competitions/${r.t?.slug}/resultats`}
                    className="min-w-0 flex-1 truncate font-medium hover:text-bordeaux"
                  >
                    {r.t?.name}
                  </Link>
                  <span className="tabular text-sm text-stone">
                    {t("rankPoints", { rank: r.rank ?? 0, points: r.points ?? 0 })}
                  </span>
                  {r.rating_delta != null ? (
                    <span
                      className={`tabular w-12 text-right text-sm font-semibold ${r.rating_delta >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {r.rating_delta >= 0 ? "+" : ""}
                      {r.rating_delta}
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("games")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {(games ?? []).map((g) => (
              <li key={g.id}>
                <Link
                  href={`/parties/${g.id}`}
                  className="flex gap-2 py-2 text-[0.95rem] hover:text-bordeaux"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {g.white_name} – {g.black_name}
                  </span>
                  <span className="tabular font-semibold">{g.result.replace(/1\/2/g, "½")}</span>
                  <span className="text-sm text-stone">
                    {g.played_on ? formatDate(g.played_on, locale, { dateStyle: "short" }) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
