import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { AwardVoteButton } from "@/components/community/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.awards");
  return { title: t("title"), description: t("intro") };
}

export default async function AwardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edition?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("community.awards");
  const supabase = await createClient();
  const session = await getSession();
  const me = session?.profile ?? null;
  const { data: editions } = await supabase
    .from("award_editions")
    .select("*")
    .neq("status", "draft")
    .order("is_demo")
    .order("year", { ascending: false });
  const edition = editions?.find((e) => e.slug === sp.edition) ?? editions?.[0] ?? null;
  const [{ data: categories }, { data: myVotes }, { data: results }] = edition
    ? await Promise.all([
        supabase
          .from("award_categories")
          .select(
            "id, name, description, position, award_nominees(id, name, description, profile_id)",
          )
          .eq("edition_id", edition.id)
          .order("position"),
        me
          ? supabase.from("award_votes").select("category_id, nominee_id")
          : Promise.resolve({ data: [] }),
        edition.status === "closed"
          ? supabase.rpc("award_results", { p_edition: edition.id })
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const votesFor = new Map((results ?? []).map((r) => [r.nominee_id, Number(r.votes)]));
  const voting =
    edition?.status === "voting" &&
    (!edition.voting_ends_at || new Date(edition.voting_ends_at) > new Date());
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/awards" />
      </CommunityHeader>
      {editions && editions.length > 1 ? (
        <nav aria-label={t("editions")} className="mt-6 flex flex-wrap gap-2">
          {editions.map((e) => (
            <Link
              key={e.id}
              href={`/communaute/awards?edition=${e.slug}`}
              aria-current={e.id === edition?.id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${e.id === edition?.id ? "bg-ink text-cream" : "border border-line"}`}
            >
              {tr(e.title, locale)}
            </Link>
          ))}
        </nav>
      ) : null}
      {!edition ? (
        <p className="mt-8 text-stone">{t("none")}</p>
      ) : (
        <section className="mt-8">
          <h2 className="font-display text-3xl font-semibold">{tr(edition.title, locale)}</h2>
          {edition.is_demo ? <p className="mt-1 font-semibold text-bordeaux">{t("demo")}</p> : null}
          <p className="mt-1 text-stone">
            {voting
              ? edition.voting_ends_at
                ? t("votingUntil", { date: formatDateTime(edition.voting_ends_at, locale) })
                : t("votingOpen")
              : edition.status === "closed"
                ? t("results")
                : t("votingClosed")}
          </p>
          {voting && !me ? (
            <Link
              href={`/connexion?next=${encodeURIComponent("/communaute/awards")}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-cream"
            >
              {t("signIn")}
            </Link>
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(categories ?? []).map((c) => {
              const nominees = [...c.award_nominees].sort(
                (a, b) => (votesFor.get(b.id) ?? 0) - (votesFor.get(a.id) ?? 0),
              );
              const top = votesFor.get(nominees[0]?.id ?? "") ?? 0;
              // Lauréat affiché seulement sans égalité en tête.
              const winner =
                top > 0 && (nominees.length < 2 || top > (votesFor.get(nominees[1]!.id) ?? 0));
              const chosen = myVotes?.find((v) => v.category_id === c.id)?.nominee_id;
              return (
                <article key={c.id} className="rounded-[var(--radius-card)] border border-line p-5">
                  <h3 className="font-display text-2xl font-semibold">{tr(c.name, locale)}</h3>
                  {tr(c.description, locale) ? (
                    <p className="text-stone">{tr(c.description, locale)}</p>
                  ) : null}
                  <ul className="mt-3 divide-y divide-line">
                    {nominees.map((n, i) => (
                      <li key={n.id} className="flex flex-wrap items-center gap-3 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {n.name}
                            {edition.status === "closed" && winner && i === 0 ? (
                              <span className="ml-2 rounded-full bg-gold/25 px-2 py-0.5 text-xs uppercase">
                                {t("winner")}
                              </span>
                            ) : null}
                          </span>
                          {n.description ? (
                            <span className="block text-sm text-stone">{n.description}</span>
                          ) : null}
                        </span>
                        {edition.status === "closed" ? (
                          <span className="tabular text-sm font-semibold">
                            {t("votes", { n: votesFor.get(n.id) ?? 0 })}
                          </span>
                        ) : voting && me ? (
                          <AwardVoteButton
                            nomineeId={n.id}
                            chosen={chosen === n.id}
                            label={n.name}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
