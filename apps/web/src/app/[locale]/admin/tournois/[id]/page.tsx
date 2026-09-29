import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { teamsBody, onlineBody, scoresheetBody } from "./extra-tabs";
import { ParticipantsImport } from "@/components/admin/participants-import";
import { WalkInForm } from "@/components/admin/walk-in-form";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { RegistrationActions } from "@/components/admin/registration-actions";
import { CheckInScanner } from "@/components/admin/check-in-scanner";
import { ResultsImport } from "@/components/admin/results-import";
import { TournamentSettings } from "@/components/admin/tournament-settings";
import { RoundsManager } from "@/components/admin/rounds-manager";
import { PostersPanel } from "@/components/admin/posters-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import type { CustomField } from "@chesspirit/shared";
import { loadState } from "@/lib/tournament-engine";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

const TABS = [
  "inscrits",
  "pointage",
  "rondes",
  "equipes",
  "en-ligne",
  "resultats",
  "feuilles",
  "affiches",
  "reglages",
] as const;

export default async function AdminTournament({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { onglet } = await searchParams;
  const isNew = id === "nouveau";
  const session = await requireStaff(locale, `/admin/tournois/${id}`);
  const t = await getTranslations("admin");
  const supabase = await createClient();

  if (isNew) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        <h1 className="font-display text-4xl font-semibold">{t("newTournament")}</h1>
        <div className="mt-6">
          <TournamentSettings tournament={null} prizesText="" partnersText="" />
        </div>
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: tn } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!tn) notFound();
  // Onglets selon le format : équipes pour les tournois par équipes, « en ligne » pour Lichess.
  const isTeam = tn.pairing_system === "team_swiss";
  const { data: ocrFlag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "scoresheet_ocr")
    .maybeSingle();
  const tabs = TABS.filter(
    (k) =>
      (k !== "feuilles" || (!!ocrFlag?.enabled && !isTeam)) &&
      (k !== "equipes" || isTeam) &&
      (k !== "rondes" || !isTeam) &&
      (k !== "en-ligne" || tn.is_online),
  );
  const tab = (tabs as readonly string[]).includes(onglet ?? "")
    ? (onglet as (typeof TABS)[number])
    : "inscrits";

  let body: React.ReactNode = null;
  if (tab === "inscrits") {
    await supabase.rpc("log_admin_view", {
      p_object_type: "tournaments",
      p_object_id: tn.id,
      p_context: "registrations_list",
    });
    const { data: regs } = await supabase
      .from("registrations")
      .select(
        "id, status, payment_status, payment_method, amount_xof, seed_rating, checked_in_at, ticket_code, answers, profiles!registrations_player_id_fkey(first_name, last_name, phone, club_name, birth_date, sex)",
      )
      .eq("tournament_id", tn.id)
      .order("created_at");
    const active = (regs ?? []).filter((r) => !["cancelled", "refused"].includes(r.status));
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-stone">
            {t("registrantsSummary", {
              total: active.length,
              checked: active.filter((r) => r.checked_in_at).length,
            })}
          </p>
          {}
          <a
            href={`/api/admin/tournaments/${tn.id}/registrations`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-fg/25 px-4 font-semibold hover:bg-surface"
          >
            <IconDownload className="size-5" /> {t("exportCsv")}
          </a>
        </div>
        <WalkInForm tournamentId={tn.id} />
        <ParticipantsImport tournamentId={tn.id} />
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-surface/70 text-xs uppercase tracking-[0.08em] text-stone">
              <tr>
                <th className="px-3 py-2">{t("col.player")}</th>
                <th className="px-3 py-2">{t("col.phone")}</th>
                <th className="px-3 py-2">{t("col.club")}</th>
                <th className="px-3 py-2 text-right">{t("col.rating")}</th>
                <th className="px-3 py-2">{t("col.status")}</th>
                <th className="px-3 py-2">{t("col.payment")}</th>
                <th className="px-3 py-2">{t("col.checkin")}</th>
                <th className="px-3 py-2">{t("col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(regs ?? []).map((r) => (
                <tr
                  key={r.id}
                  className={["cancelled", "refused"].includes(r.status) ? "opacity-50" : undefined}
                >
                  <td className="px-3 py-2 font-medium">
                    {r.profiles?.first_name} {r.profiles?.last_name}
                  </td>
                  <td className="tabular px-3 py-2">{r.profiles?.phone ?? "—"}</td>
                  <td className="px-3 py-2">{r.profiles?.club_name ?? ""}</td>
                  <td className="tabular px-3 py-2 text-right">{r.seed_rating ?? "—"}</td>
                  <td className="px-3 py-2">{t(`reg.${r.status}`)}</td>
                  <td className="px-3 py-2">
                    {t(`pay.${r.payment_status}`)}
                    {r.amount_xof ? (
                      <span className="block text-xs text-stone">
                        {formatXof(r.amount_xof, locale)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.checked_in_at ? "✓" : ""}</td>
                  <td className="px-3 py-2">
                    <RegistrationActions
                      id={r.id}
                      status={r.status}
                      payment={r.payment_status}
                      ticket={r.ticket_code}
                      checkedIn={!!r.checked_in_at}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else if (tab === "pointage") {
    body = <CheckInScanner />;
  } else if (tab === "rondes") {
    const offlineLink = (
      <p className="mb-4 text-sm">
        <Link href={`/arbitrage/${tn.id}`} className="font-semibold text-accent hover:underline">
          {t("offlineMode")} →
        </Link>
      </p>
    );
    const st = await loadState(supabase, tn.id);
    const { data: canManage } = await supabase
      .from("tournaments")
      .select("id")
      .eq("id", tn.id)
      .maybeSingle();
    body = (
      <>
        {offlineLink}
        <RoundsManager
          tournamentId={tn.id}
          slug={tn.slug}
          system={tn.pairing_system}
          roundsCount={tn.rounds_count}
          canClose={!!canManage}
          participants={st.participants.map((p) => ({
            registrationId: p.registrationId,
            playerId: p.playerId,
            startNo: p.startNo,
            name: p.name,
            rating: p.rating,
            checkedIn: p.checkedIn,
            withdrawn: p.withdrawn,
            byeRequests: p.byeRequests,
          }))}
          rounds={st.rounds.map((r) => ({
            id: r.id,
            number: r.number,
            status: r.status,
            published: !!r.published_at,
            engine: r.pairing_engine,
          }))}
          pairings={st.pairings.map((p) => ({
            id: p.id,
            roundId: p.round_id,
            board: p.board,
            white: p.white_id,
            black: p.black_id,
            result: p.result,
            byeType: p.bye_type,
            stage: p.stage,
            manual: p.is_manual,
          }))}
        />
      </>
    );
  } else if (tab === "equipes") {
    body = await teamsBody(supabase, tn.id);
  } else if (tab === "en-ligne") {
    body = await onlineBody(supabase, tn);
  } else if (tab === "affiches") {
    const { count } = await supabase
      .from("standings")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tn.id);
    body = <PostersPanel slug={tn.slug} hasResults={(count ?? 0) > 0} />;
  } else if (tab === "feuilles") {
    body = await scoresheetBody(supabase, tn.id);
  } else if (tab === "resultats") {
    body = <ResultsImport tournamentId={tn.id} slug={tn.slug} />;
  } else {
    const [
      { data: prizes },
      { data: partners },
      { data: staff },
      { data: form },
      { data: manageable },
    ] = await Promise.all([
      supabase.from("prizes").select("*").eq("tournament_id", tn.id).order("position"),
      supabase.from("tournament_partners").select("*").eq("tournament_id", tn.id).order("position"),
      supabase.rpc("tournament_staff_list", { p_tournament_id: tn.id }),
      supabase.from("registration_forms").select("fields").eq("tournament_id", tn.id).maybeSingle(),
      supabase.rpc("my_managed_tournaments"),
    ]);
    const canManage =
      !!session.admin ||
      (manageable ?? []).some(
        (x) => x.id === tn.id && x.organizer_profile_id === session.session.profile?.id,
      );
    body = (
      <div className="space-y-12">
        <StaffPanel
          tournamentId={tn.id}
          slug={tn.slug}
          canManage={canManage}
          staff={(staff ?? []).map((s) => ({
            id: s.id,
            role: s.role,
            name: s.name,
            phone: s.phone,
          }))}
        />
        <TournamentSettings
          tournament={{
            ...tn,
            description_fr: tr(tn.description, "fr"),
            description_en: tr(tn.description, "en"),
          }}
          prizesText={(prizes ?? [])
            .map((p) => `${tr(p.label, "fr")}${p.amount_xof != null ? ` ; ${p.amount_xof}` : ""}`)
            .join("\n")}
          partnersText={(partners ?? []).map((p) => p.name).join("\n")}
          formFields={(form?.fields ?? []) as CustomField[]}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <nav className="text-sm text-stone">
        <Link href="/admin" className="hover:text-accent">
          {t("title")}
        </Link>
        {" · "}
        <Link href={`/competitions/${tn.slug}`} className="hover:text-accent">
          {t("publicPage")}
        </Link>
      </nav>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{tn.name}</h1>
      <nav aria-label={t("tabs")} className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-line">
          {tabs.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/tournois/${tn.id}?onglet=${k}`}
                aria-current={tab === k ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 font-semibold ${tab === k ? "border-accent text-accent" : "border-transparent text-fg/70 hover:text-accent"}`}
              >
                {t(`tab.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">{body}</div>
    </div>
  );
}
