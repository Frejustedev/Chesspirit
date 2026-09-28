import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { Tbc } from "@/components/ui/tbc";
import { AgreeButton, LicenseButton, PostponeForm } from "@/components/competitions/league-actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyLeagues({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/ligues");
  const t = await getTranslations("myLeagues");
  const tl = await getTranslations("leagues");
  const supabase = await createClient();
  const me = session.profile!;
  const { data: people } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .or(`id.eq.${me.id},guardian_id.eq.${me.id}`);
  const ids = (people ?? []).map((p) => p.id);
  const [{ data: seasons }, { data: licenses }, { data: memberships }, { data: postponements }] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("*")
        .neq("status", "closed")
        .eq("is_demo", false)
        .order("starts_on"),
      supabase.from("league_licenses").select("*").in("profile_id", ids),
      supabase
        .from("league_members")
        .select("profile_id, status, leagues(id, slug, division, cadence, seasons(name))")
        .in("profile_id", ids),
      supabase
        .from("league_postponements")
        .select("id, status, opponent_agreed, reason, proposed_date, requested_by, pairing_id"),
    ]);
  const leagueIds = (memberships ?? []).map((m) => m.leagues?.id).filter(Boolean) as string[];
  const { data: open } = leagueIds.length
    ? await supabase
        .from("pairings")
        .select(
          "id, white_id, black_id, result, rounds(number), tournaments!inner(name, league_id)",
        )
        .in("tournaments.league_id", leagueIds)
        .is("result", null)
        .not("black_id", "is", null)
        .or(`white_id.in.(${ids.join(",")}),black_id.in.(${ids.join(",")})`)
        .limit(50)
    : { data: [] };
  const nameOf = (id: string) => {
    const p = people?.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "";
  };
  return (
    <AccountShell
      nav={<AccountNav current="/compte/ligues" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("licenses")}</h2>
        {seasons?.length ? (
          <ul className="mt-3 space-y-3">
            {seasons.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-4">
                <p className="font-semibold">
                  {s.name} ·{" "}
                  {s.license_fee_xof === null ? <Tbc /> : formatXof(s.license_fee_xof, locale)}
                </p>
                <ul className="mt-2 space-y-2">
                  {(people ?? []).map((p) => {
                    const lic = licenses?.find(
                      (l) => l.season_id === s.id && l.profile_id === p.id,
                    );
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3">
                        <span className="min-w-0 flex-1">
                          {p.first_name} {p.last_name}
                        </span>
                        {lic && lic.status !== "pending_payment" ? (
                          <span className="rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold">
                            {t(`licenseStatus.${lic.status}`)}
                          </span>
                        ) : s.license_fee_xof === null ? (
                          <span className="text-sm text-stone">{t("feeTbc")}</span>
                        ) : (
                          <LicenseButton seasonId={s.id} profileId={p.id} pending={!!lic} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-stone">{t("noSeason")}</p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("myLeagues")}</h2>
        {memberships?.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {memberships.map((m) =>
              m.leagues ? (
                <li key={`${m.profile_id}-${m.leagues.id}`} className="flex flex-wrap gap-3 py-3">
                  <Link
                    href={`/competitions/ligues/${m.leagues.slug}`}
                    className="font-semibold hover:text-accent"
                  >
                    {tl(`division.${m.leagues.division}`)} · {tl(`cadence.${m.leagues.cadence}`)}
                  </Link>
                  <span className="text-sm text-stone">
                    {m.leagues.seasons?.name} · {nameOf(m.profile_id)}
                  </span>
                  {m.status !== "active" ? (
                    <span className="text-sm font-semibold text-accent">
                      {t(`memberStatus.${m.status}`)}
                    </span>
                  ) : null}
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="mt-2 text-stone">{t("noLeague")}</p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("postponements")}</h2>
        <p className="mt-1 text-sm text-stone">{t("postponeHelp")}</p>
        <ul className="mt-3 space-y-3">
          {(open ?? []).map((pr) => {
            const mine = ids.includes(pr.white_id) ? pr.white_id : pr.black_id!;
            const req = postponements?.find((x) => x.pairing_id === pr.id);
            return (
              <li key={pr.id} className="rounded-lg border border-line p-4">
                <p className="font-semibold">
                  {pr.tournaments?.name} · {t("round", { n: pr.rounds?.number ?? 0 })}
                </p>
                {req ? (
                  <div className="mt-2 text-sm">
                    <p>
                      {t(`postponeStatus.${req.status}`)}
                      {req.proposed_date
                        ? ` · ${formatDate(req.proposed_date, locale)}`
                        : ""} · {req.opponent_agreed ? t("opponentAgreed") : t("opponentPending")}
                    </p>
                    {req.reason ? <p className="text-stone">{req.reason}</p> : null}
                    {!req.opponent_agreed &&
                    !ids.includes(req.requested_by) &&
                    req.status === "pending" ? (
                      <AgreeButton id={req.id} />
                    ) : null}
                  </div>
                ) : (
                  <PostponeForm pairingId={pr.id} profileId={mine} />
                )}
              </li>
            );
          })}
          {!open?.length ? <li className="text-stone">{t("noOpenGames")}</li> : null}
        </ul>
      </section>
    </AccountShell>
  );
}
