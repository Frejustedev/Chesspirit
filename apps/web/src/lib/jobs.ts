import "server-only";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyProfile } from "@/lib/notifications";
import { recomputeAllRatings } from "@/lib/ratings";

type Db = ReturnType<typeof createAdminClient>;
export const JOBS = [
  "expire-orders",
  "refresh-minors",
  "reminders",
  "rating-lists",
  "fide-import",
  "admin-digest",
  "monthly-report",
] as const;
export type JobName = (typeof JOBS)[number];

/** Rappels J-1 des tournois et des cours (une seule fois par inscription ou réservation). */
async function reminders(db: Db) {
  const now = Date.now();
  const in24 = new Date(now + 24 * 3600 * 1000).toISOString();
  const in36 = new Date(now + 36 * 3600 * 1000).toISOString();
  const { data: regs } = await db
    .from("registrations")
    .select("id, player_id, ticket_code, tournaments!inner(name, starts_at, venue)")
    .in("status", ["confirmed", "pending_validation"])
    .is("reminder_sent_at", null)
    .gte("tournaments.starts_at", in24.slice(0, 10))
    .lte("tournaments.starts_at", in36);
  let sent = 0;
  for (const r of regs ?? []) {
    const t = r.tournaments;
    await notifyProfile(r.player_id, {
      template: "tournament_reminder",
      subject: `Rappel : ${t.name}`,
      text: `Chesspirit : rappel, ${t.name} commence le ${formatDateTime(t.starts_at)}${t.venue ? ` (${t.venue})` : ""}. Billet : chesspirit.com/billet/${r.ticket_code}`,
      whatsappTemplate: {
        name: "tournament_reminder",
        params: [t.name, formatDateTime(t.starts_at)],
      },
    });
    await db
      .from("registrations")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", r.id);
    sent++;
  }
  const { data: bookings } = await db
    .from("bookings")
    .select("id, student_id, meeting_url, availability_slots!inner(starts_at, location)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("availability_slots.starts_at", new Date(now).toISOString())
    .lte("availability_slots.starts_at", in24);
  for (const b of bookings ?? []) {
    const at = formatDateTime(b.availability_slots.starts_at);
    await notifyProfile(b.student_id, {
      template: "booking_reminder",
      subject: "Rappel de cours",
      text: `Chesspirit : rappel, cours le ${at}${b.meeting_url ? ` — visio : ${b.meeting_url}` : b.availability_slots.location ? ` — ${b.availability_slots.location}` : ""}.`,
      whatsappTemplate: { name: "booking_reminder", params: [at] },
    });
    await db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
    sent++;
  }
  return { sent };
}

/** Import mensuel FIDE via le service Python (fédération BEN et identifiants connus), puis recalcul des cotes. */
async function fideImport(db: Db) {
  const url = process.env.CHESS_ENGINE_URL;
  const key = process.env.CHESS_ENGINE_KEY;
  if (!url || !key) throw new Error("engine_not_configured");
  const { data: known } = await db.from("profiles").select("fide_id").not("fide_id", "is", null);
  const res = await fetch(`${url}/fide/import`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-engine-key": key },
    body: JSON.stringify({
      federation: "BEN",
      ids: (known ?? []).map((k) => k.fide_id).filter(Boolean),
      ...(process.env.FIDE_LIST_URL ? { url: process.env.FIDE_LIST_URL } : {}),
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`engine_${res.status}`);
  const players = (await res.json()) as {
    fide_id: string;
    name: string | null;
    federation: string | null;
    title: string | null;
    standard: number | null;
    rapid: number | null;
    blitz: number | null;
    birth_year: number | null;
    sex: string | null;
  }[];
  const period = new Date().toISOString().slice(0, 8) + "01";
  for (let i = 0; i < players.length; i += 500) {
    const { error } = await db.from("fide_ratings").upsert(
      players.slice(i, i + 500).map((p) => ({
        fide_id: p.fide_id,
        period,
        name: p.name,
        federation: p.federation,
        title: p.title,
        standard: p.standard,
        rapid: p.rapid,
        blitz: p.blitz,
        birth_year: p.birth_year,
        sex: p.sex?.slice(0, 1) ?? null,
      })),
      { onConflict: "fide_id,period" },
    );
    if (error) throw new Error(error.message);
  }
  const ratings = await recomputeAllRatings();
  return { players: players.length, period, ratings };
}

async function adminEmails(db: Db) {
  const { data: roles } = await db
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);
  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("id, email").in("user_id", ids);
  return (profiles ?? []).filter((p) => p.email) as { id: string; email: string }[];
}

/** Synthèse quotidienne des alertes (stock bas, tournoi presque complet, paiements…). */
async function adminDigest(db: Db) {
  const { data: alerts } = await db.rpc("admin_alerts");
  const list = (alerts ?? []) as { kind: string; count: number; detail: string | null }[];
  if (!list.length) return { alerts: 0 };
  const labels: Record<string, string> = {
    low_stock: "Stock bas",
    tournament_almost_full: "Tournoi presque complet",
    payment_failed: "Paiements échoués (7 jours)",
    needs_refund: "Paiements à rembourser",
    pending_requests: "Demandes en attente",
  };
  const text = list
    .map((a) => `- ${labels[a.kind] ?? a.kind} : ${a.count}${a.detail ? ` (${a.detail})` : ""}`)
    .join("\n");
  const to = await adminEmails(db);
  await notify(
    to.map((a) => ({
      profileId: a.id,
      channel: "email" as const,
      to: a.email,
      template: "admin_digest",
      subject: "Chesspirit : alertes du jour",
      text: `Alertes du jour :\n${text}\n\nchesspirit.com/admin`,
    })),
  );
  return { alerts: list.length, recipients: to.length };
}

/** Rapport mensuel par e-mail (mois écoulé). */
async function monthlyReport(db: Db) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);
  const { data } = await db.rpc("admin_stats", { p_from: from, p_to: to });
  const s = (data ?? {}) as {
    users?: { new?: number; total?: number };
    competitions?: { tournaments?: number; registrations?: number };
    finance?: { revenue?: number };
    coaching?: { bookings?: number };
    shop?: { orders?: number };
  };
  const text = [
    `Rapport du ${from} au ${to}`,
    `- Nouveaux profils : ${s.users?.new ?? 0} (total ${s.users?.total ?? 0})`,
    `- Tournois : ${s.competitions?.tournaments ?? 0}, inscriptions : ${s.competitions?.registrations ?? 0}`,
    `- Cours réservés : ${s.coaching?.bookings ?? 0}`,
    `- Commandes : ${s.shop?.orders ?? 0}`,
    `- Encaissements : ${formatXof(s.finance?.revenue ?? 0)}`,
    "",
    "Détails : chesspirit.com/admin/statistiques",
  ].join("\n");
  const recipients = await adminEmails(db);
  await notify(
    recipients.map((a) => ({
      profileId: a.id,
      channel: "email" as const,
      to: a.email,
      template: "monthly_report",
      subject: `Chesspirit : rapport mensuel ${from.slice(0, 7)}`,
      text,
    })),
  );
  return { from, to, recipients: recipients.length };
}

export async function runJob(job: JobName) {
  const db = createAdminClient();
  const { data: run } = await db.from("job_runs").insert({ job }).select("id").single();
  try {
    const maintenance = async (p_job: string) => {
      const { data, error } = await db.rpc("run_maintenance", { p_job });
      if (error) throw new Error(error.message);
      return data;
    };
    let details: unknown;
    if (job === "expire-orders") details = await maintenance("expire_orders");
    else if (job === "refresh-minors") details = await maintenance("refresh_minors");
    else if (job === "rating-lists") details = await maintenance("publish_rating_lists");
    else if (job === "reminders") details = await reminders(db);
    else if (job === "fide-import") details = await fideImport(db);
    else if (job === "admin-digest") details = await adminDigest(db);
    else details = await monthlyReport(db);
    await db
      .from("job_runs")
      .update({
        status: "succeeded",
        details: (details ?? {}) as never,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run!.id);
    return { ok: true as const, details };
  } catch (e) {
    await db
      .from("job_runs")
      .update({
        status: "failed",
        details: { error: (e as Error).message },
        finished_at: new Date().toISOString(),
      })
      .eq("id", run!.id);
    return { ok: false as const, error: (e as Error).message };
  }
}
