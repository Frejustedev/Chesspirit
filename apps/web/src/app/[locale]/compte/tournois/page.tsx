import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyTournaments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/tournois");
  const t = await getTranslations("myTournaments");
  const supabase = await createClient();
  const me = session.profile!.id;
  const [{ data: regs }, { data: standings }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, status, tournament_id, tournaments(name, slug, starts_at, status, cadence)")
      .eq("player_id", me)
      .not("status", "in", "(cancelled,refused)"),
    supabase
      .from("standings")
      .select("tournament_id, rank, points, performance, rating_delta, prize, games")
      .eq("player_id", me),
  ]);
  const byT = new Map((standings ?? []).map((s) => [s.tournament_id, s]));
  const rows = (regs ?? [])
    .filter((r) => r.tournaments)
    .sort((a, b) => b.tournaments!.starts_at.localeCompare(a.tournaments!.starts_at));
  // Tournois importés sans inscription (profil pré-créé puis réclamé).
  const extra = (standings ?? []).filter(
    (s) => !rows.some((r) => r.tournament_id === s.tournament_id),
  );
  const { data: extraT } = extra.length
    ? await supabase
        .from("tournaments")
        .select("id, name, slug, starts_at")
        .in(
          "id",
          extra.map((e) => e.tournament_id),
        )
    : { data: [] };

  return (
    <AccountShell
      nav={<AccountNav current="/compte/tournois" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      {rows.length + extra.length === 0 ? (
        <p className="text-stone">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[40rem] text-left text-[0.95rem]">
            <thead className="bg-cream/70 text-xs uppercase tracking-[0.08em] text-stone">
              <tr>
                <th className="px-3 py-2">{t("tournament")}</th>
                <th className="px-3 py-2 text-right">{t("rank")}</th>
                <th className="px-3 py-2 text-right">{t("score")}</th>
                <th className="px-3 py-2 text-right">{t("perf")}</th>
                <th className="px-3 py-2 text-right">{t("delta")}</th>
                <th className="px-3 py-2">{t("prize")}</th>
                <th className="px-3 py-2">{t("certificate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const s = byT.get(r.tournament_id);
                const done = ["finished", "archived"].includes(r.tournaments!.status);
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/competitions/${r.tournaments!.slug}${done ? "/resultats" : ""}`}
                        className="font-medium hover:text-bordeaux"
                      >
                        {r.tournaments!.name}
                      </Link>
                      <span className="block text-xs text-stone">
                        {formatDate(r.tournaments!.starts_at, locale)}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right">{s?.rank ?? "—"}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {s ? `${s.points}${s.games ? ` / ${s.games}` : ""}` : "—"}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{s?.performance ?? "—"}</td>
                    <td
                      className={`tabular px-3 py-2 text-right font-semibold ${s?.rating_delta == null ? "" : s.rating_delta >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {s?.rating_delta == null
                        ? "—"
                        : `${s.rating_delta >= 0 ? "+" : ""}${s.rating_delta}`}
                    </td>
                    <td className="px-3 py-2">{s?.prize ?? ""}</td>
                    <td className="px-3 py-2">
                      {done ? (
                        <a
                          href={`/api/attestations/${r.id}`}
                          className="inline-flex min-h-11 items-center gap-1 font-semibold text-bordeaux hover:underline"
                        >
                          <IconDownload className="size-4" /> PDF
                        </a>
                      ) : (
                        <span className="text-sm text-stone">{t("upcoming")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(extraT ?? []).map((x) => {
                const s = byT.get(x.id)!;
                return (
                  <tr key={x.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/competitions/${x.slug}/resultats`}
                        className="font-medium hover:text-bordeaux"
                      >
                        {x.name}
                      </Link>
                      <span className="block text-xs text-stone">
                        {formatDate(x.starts_at, locale)}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right">{s.rank}</td>
                    <td className="tabular px-3 py-2 text-right">{s.points}</td>
                    <td className="tabular px-3 py-2 text-right">{s.performance ?? "—"}</td>
                    <td className="tabular px-3 py-2 text-right">{s.rating_delta ?? "—"}</td>
                    <td className="px-3 py-2">{s.prize ?? ""}</td>
                    <td className="px-3 py-2 text-sm text-stone">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
