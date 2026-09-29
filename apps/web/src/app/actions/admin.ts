"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { indexGames } from "@/lib/positions";
import { Chess } from "chess.js";
import {
  customFieldSchema,
  localDate,
  normalizeName,
  parsePgn,
  standingImportRowSchema,
  tournamentSchema,
  type CustomField,
} from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { TablesUpdate } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const uuid = z.string().uuid();

export async function checkInAction(
  code: string,
  markPaid: boolean,
): Promise<Result<{ name: string; already: boolean; payment: string; status: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", {
    p_ticket_code: code.replace(/.*\/billet\//, "").trim(),
    p_mark_paid: markPaid,
  });
  if (error || !data?.[0]) return { ok: false, error: error?.message ?? "ticket_not_found" };
  const r = data[0];
  return {
    ok: true,
    data: { name: r.display_name, already: r.already, payment: r.payment_status, status: r.status },
  };
}

export async function updateRegistrationAction(
  id: string,
  patch: "paid" | "confirm" | "cancel" | "refuse",
): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const update: TablesUpdate<"registrations"> =
    patch === "paid"
      ? { payment_status: "paid" }
      : patch === "confirm"
        ? { status: "confirmed", waitlist_position: null }
        : patch === "cancel"
          ? { status: "cancelled" }
          : { status: "refused" };
  const { data, error } = await supabase
    .from("registrations")
    .update(update)
    .eq("id", id)
    .select("tournament_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tournois/${data.tournament_id}`);
  return { ok: true };
}

/** Import du classement final depuis un CSV déjà découpé côté client (validé ici). */
export async function importStandingsAction(
  tournamentId: string,
  rows: unknown[],
): Promise<Result<number>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const parsed = z.array(standingImportRowSchema).min(1).max(2000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "invalid_rows" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_standings", {
    p_tournament_id: tournamentId,
    p_rows: parsed.data as never,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: data ?? 0 };
}

/** Import de parties PGN : validation par chess.js, liaison automatique aux joueurs du tournoi. */
export async function importPgnAction(
  tournamentId: string,
  content: string,
): Promise<Result<{ imported: number; rejected: number; linked: number }>> {
  if (!uuid.safeParse(tournamentId).success || content.length > 5_000_000)
    return { ok: false, error: "invalid" };
  const session = await getSession();
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, cadence, starts_at")
    .eq("id", tournamentId)
    .single();
  if (!t) return { ok: false, error: "forbidden" };
  const { data: regs } = await supabase
    .from("registrations")
    .select("player_id, profiles!registrations_player_id_fkey(first_name, last_name)")
    .eq("tournament_id", tournamentId);
  const { data: st } = await supabase
    .from("public_standings")
    .select("player_id, display_name")
    .eq("tournament_id", tournamentId);
  const byName = new Map<string, string>();
  for (const r of regs ?? [])
    if (r.profiles)
      byName.set(normalizeName(`${r.profiles.first_name} ${r.profiles.last_name}`), r.player_id);
  for (const s of st ?? [])
    if (s.display_name && s.player_id) byName.set(normalizeName(s.display_name), s.player_id);

  const rows = [];
  let rejected = 0;
  let linked = 0;
  for (const g of parsePgn(content)) {
    const chess = new Chess();
    try {
      chess.loadPgn(g.raw);
    } catch {
      rejected++;
      continue;
    }
    const h = g.headers;
    const white = h.White ?? "?";
    const black = h.Black ?? "?";
    const wid = byName.get(normalizeName(white)) ?? null;
    const bid = byName.get(normalizeName(black)) ?? null;
    if (wid && bid) linked++;
    const result = ["1-0", "0-1", "1/2-1/2"].includes(h.Result ?? "") ? h.Result! : "*";
    rows.push({
      tournament_id: tournamentId,
      round_number: parseInt(h.Round ?? "", 10) || null,
      board: parseInt(h.Board ?? "", 10) || null,
      white_id: wid,
      black_id: bid,
      white_name: white,
      black_name: black,
      white_rating: parseInt(h.WhiteElo ?? "", 10) || null,
      black_rating: parseInt(h.BlackElo ?? "", 10) || null,
      result,
      pgn: g.raw,
      eco: /^[A-E]\d\d$/.test(h.ECO ?? "") ? h.ECO! : null,
      opening: h.Opening ?? null,
      moves_count: Math.ceil(chess.history().length / 2),
      played_on: /^\d{4}\.\d{2}\.\d{2}$/.test(h.Date ?? "")
        ? h.Date!.replace(/\./g, "-")
        : localDate(t.starts_at),
      cadence: t.cadence,
      source: "upload" as const,
      validated_by: session?.userId ?? null,
      validated_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    const { data: inserted, error } = await supabase.from("games").insert(rows).select("id");
    if (error) return { ok: false, error: error.message };
    // Recherche par position : parties importées indexées tout de suite (la tâche planifiée rattrape le reste).
    await indexGames((inserted ?? []).map((g) => g.id)).catch(() => null);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { imported: rows.length, rejected, linked } };
}

const TIEBREAK_KEYS = [
  "buchholz_cut1",
  "buchholz",
  "sonneborn_berger",
  "direct_encounter",
  "wins",
  "performance",
] as const;

const settingsSchema = tournamentSchema.omit({ starts_at: true }).extend({
  starts_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  ends_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  status: z.enum([
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "ongoing",
    "finished",
    "archived",
    "cancelled",
  ]),
  cadence: z.enum(["blitz", "rapid", "classical"]).optional().or(z.literal("")),
  description_fr: z.string().max(10000).optional(),
  description_en: z.string().max(10000).optional(),
  edition: z.string().max(80).optional(),
  unconfirmed_fields: z.array(z.string()).default([]),
  allow_online_payment: z.boolean().default(true),
  allow_on_site_payment: z.boolean().default(true),
  prizes_text: z.string().max(4000).optional(),
  partners_text: z.string().max(2000).optional(),
  tiebreaks: z.array(z.enum(TIEBREAK_KEYS)).min(1).max(6).optional(),
  conditions: z
    .object({
      min_rating: z.coerce.number().int().min(0).max(3500).optional(),
      max_rating: z.coerce.number().int().min(0).max(3500).optional(),
      min_age: z.coerce.number().int().min(3).max(120).optional(),
      max_age: z.coerce.number().int().min(3).max(120).optional(),
      sex: z.enum(["M", "F"]).optional(),
    })
    .optional(),
  validation_mode: z.enum(["auto", "manual"]).optional(),
  waitlist_enabled: z.boolean().optional(),
  counts_for_tour: z.boolean().optional(),
  bye_points: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).optional(),
  initial_color: z.enum(["white1", "black1"]).optional(),
  form_fields: z.array(customFieldSchema).max(20).optional(),
});

export async function saveTournamentAction(
  id: string | null,
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: `invalid:${parsed.error.issues.map((i) => i.path.join(".")).join(",")}`,
    };
  const v = parsed.data;
  // Heure locale de Porto-Novo (UTC+1) ; sans heure, le tournoi est daté du jour et les horaires restent « À confirmer ».
  const time = v.starts_time || "00:00";
  const startsAt = new Date(`${v.starts_date}T${time}:00+01:00`).toISOString();
  const endsAt =
    v.ends_date && v.ends_date >= v.starts_date
      ? new Date(`${v.ends_date}T23:00:00+01:00`).toISOString()
      : null;
  const unconfirmed = new Set(v.unconfirmed_fields);
  if (!v.starts_time) unconfirmed.add("schedule");
  else unconfirmed.delete("schedule");
  const conditions = Object.fromEntries(
    Object.entries(v.conditions ?? {}).filter(([, x]) => x !== undefined),
  );
  const row = {
    name: v.name,
    slug: v.slug,
    edition: v.edition || null,
    venue: v.venue || null,
    city: v.city || null,
    starts_at: startsAt,
    ends_at: endsAt,
    cadence: v.cadence || null,
    base_minutes: v.base_minutes ?? null,
    increment_seconds: v.increment_seconds ?? null,
    rounds_count: v.rounds_count ?? null,
    pairing_system: v.pairing_system,
    entry_fee_xof: v.entry_fee_xof ?? null,
    capacity: v.capacity ?? null,
    is_online: v.is_online,
    rated: v.rated,
    status: v.status,
    description: { fr: v.description_fr ?? "", en: v.description_en ?? "" },
    unconfirmed_fields: [...unconfirmed],
    allow_online_payment: v.allow_online_payment,
    allow_on_site_payment: v.allow_on_site_payment,
    conditions,
    ...(v.tiebreaks ? { tiebreaks: v.tiebreaks } : {}),
    ...(v.validation_mode ? { validation_mode: v.validation_mode } : {}),
    ...(v.waitlist_enabled !== undefined ? { waitlist_enabled: v.waitlist_enabled } : {}),
    ...(v.counts_for_tour !== undefined ? { counts_for_tour: v.counts_for_tour } : {}),
    ...(v.bye_points !== undefined ? { bye_points: v.bye_points } : {}),
    ...(v.initial_color ? { initial_color: v.initial_color } : {}),
  };
  const supabase = await createClient();
  let tid = id;
  if (tid) {
    const { error } = await supabase.from("tournaments").update(row).eq("id", tid);
    if (error) return { ok: false, error: error.message };
  } else {
    const session = await getSession();
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ ...row, organizer_profile_id: session?.profile?.id ?? null })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    tid = data.id;
    await supabase
      .from("registration_forms")
      .insert({ tournament_id: tid, fields: [] as CustomField[] });
  }
  if (v.form_fields) {
    await supabase
      .from("registration_forms")
      .upsert({ tournament_id: tid!, fields: v.form_fields }, { onConflict: "tournament_id" });
  }
  // Dotations : une ligne par prix « libellé ; montant ».
  if (v.prizes_text !== undefined) {
    await supabase.from("prizes").delete().eq("tournament_id", tid!);
    const prizes = v.prizes_text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l, i) => {
        const [label, amount] = l.split(";").map((x) => x.trim());
        const n = amount ? parseInt(amount.replace(/\D/g, ""), 10) : NaN;
        return {
          tournament_id: tid!,
          kind: "rank",
          rank: i + 1,
          label: { fr: label, en: label },
          amount_xof: Number.isFinite(n) ? n : null,
          position: i,
        };
      });
    if (prizes.length) await supabase.from("prizes").insert(prizes);
  }
  if (v.partners_text !== undefined) {
    await supabase.from("tournament_partners").delete().eq("tournament_id", tid!);
    const partners = v.partners_text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name, i) => ({ tournament_id: tid!, name, role: "partner", position: i }));
    if (partners.length) await supabase.from("tournament_partners").insert(partners);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: tid! } };
}

export async function addStaffAction(
  tournamentId: string,
  identifier: string,
  role: string,
): Promise<Result> {
  if (!uuid.safeParse(tournamentId).success || identifier.trim().length < 5)
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_tournament_staff", {
    p_tournament_id: tournamentId,
    p_identifier: identifier,
    p_role: role,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tournois/${tournamentId}`);
  return { ok: true };
}

export async function removeStaffAction(tournamentId: string, staffId: string): Promise<Result> {
  if (!uuid.safeParse(staffId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_staff").delete().eq("id", staffId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tournois/${tournamentId}`);
  return { ok: true };
}

export async function duplicateTournamentAction(
  tournamentId: string,
  slug: string,
  date: string,
): Promise<Result<{ id: string }>> {
  if (
    !uuid.safeParse(tournamentId).success ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return { ok: false, error: "invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_tournament", {
    p_tournament_id: tournamentId,
    p_slug: slug,
    p_starts_at: new Date(`${date}T00:00:00+01:00`).toISOString(),
  });
  if (error || !data) return { ok: false, error: error?.message ?? "server" };
  revalidatePath("/admin");
  return { ok: true, data: { id: data.id } };
}

/** Recalcul complet des cotes (administrateur compétitions). */
export async function recomputeRatingsAction(): Promise<
  Result<{ engine: string; tournaments: number; players: number }>
> {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("admin_overview").maybeSingle();
  if (!ok) return { ok: false, error: "forbidden" };
  const { recomputeAllRatings } = await import("@/lib/ratings");
  const r = await recomputeAllRatings();
  revalidatePath("/", "layout");
  return { ok: true, data: r };
}

const SETTINGS = [
  "coaching_commission_enabled",
  "coaching_commission_rate",
  "require_admin_mfa",
  "default_start_rating",
  "contact_whatsapp",
] as const;

/** Paramètre système (super-administrateur uniquement, via la RLS). */
export async function saveSettingAction(
  key: (typeof SETTINGS)[number],
  value: boolean | number | string | null,
): Promise<Result> {
  if (!(SETTINGS as readonly string[]).includes(key)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ value: value as never })
    .eq("key", key)
    .select("key");
  if (error || !data?.length) return { ok: false, error: error?.message ?? "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

const participantRow = z.object({
  first_name: z.string().max(80),
  last_name: z.string().max(80),
  birth_date: z.string().max(10).optional(),
  sex: z.string().max(2).optional(),
  phone: z.string().max(20).optional(),
  club: z.string().max(120).optional(),
  fide_id: z.string().max(12).optional(),
  payment: z.string().max(20).optional(),
});

/** Import de participants (liste tenue hors du site) ; contrôles et rapprochement des profils en base. */
export async function importParticipantsAction(
  tournamentId: string,
  rows: unknown,
): Promise<
  Result<{
    registered: number;
    already: number;
    created_profiles: number;
    matched_profiles: number;
    errors: { line: number; error: string }[];
  }>
> {
  if (!z.string().uuid().safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const parsed = z.array(participantRow).min(1).max(1000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_participants", {
    p_tournament: tournamentId,
    p_rows: parsed.data,
  });
  if (error)
    return { ok: false, error: error.message.includes("forbidden") ? "forbidden" : "invalid" };
  revalidatePath(`/admin/tournois/${tournamentId}`);
  return { ok: true, data: data as never };
}

/** Pointage depuis la liste des inscrits (joueur venu sans son billet). */
export async function checkInRowAction(ticketCode: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", {
    p_ticket_code: ticketCode,
    p_mark_paid: true,
  });
  if (error || !data?.[0]) return { ok: false, error: error?.message ?? "ticket_not_found" };
  revalidatePath(`/admin/tournois/${data[0].tournament_id}`);
  return { ok: true };
}

const walkInRow = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  sex: z.enum(["M", "F", ""]).optional(),
  birth_date: z.string().max(10).optional(),
  phone: z.string().max(20).optional(),
  club: z.string().max(120).optional(),
});

/**
 * Joueur arrivé sans inscription : inscription confirmée (profil importé, réclamable plus tard
 * par son téléphone) puis, au choix, pointage immédiat.
 */
export async function walkInAction(
  tournamentId: string,
  raw: unknown,
  checkIn: boolean,
): Promise<Result<{ name: string; already: boolean }>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const parsed = walkInRow.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "name_required" };
  const row = parsed.data;
  // Téléphone béninois saisi sans indicatif (8 ou 10 chiffres) : +229 ajouté.
  const digits = (row.phone ?? "").replace(/[\s.-]/g, "").replace(/^00/, "+");
  row.phone = /^\d{8}$|^\d{10}$/.test(digits) ? `+229${digits}` : digits || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_participants", {
    p_tournament: tournamentId,
    p_rows: [{ ...row, sex: row.sex || undefined }],
  });
  if (error)
    return { ok: false, error: error.message.includes("forbidden") ? "forbidden" : "invalid" };
  const report = data as { registered: number; already: number; errors: { error: string }[] };
  if (report.errors.length) return { ok: false, error: report.errors[0]!.error };
  if (checkIn) {
    const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: reg } = await supabase
      .from("registrations")
      .select("ticket_code, profiles!registrations_player_id_fkey!inner(first_name, last_name)")
      .eq("tournament_id", tournamentId)
      .ilike("profiles.first_name", esc(row.first_name))
      .ilike("profiles.last_name", esc(row.last_name))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reg?.ticket_code)
      await supabase.rpc("check_in", { p_ticket_code: reg.ticket_code, p_mark_paid: true });
  }
  revalidatePath(`/admin/tournois/${tournamentId}`);
  return {
    ok: true,
    data: { name: `${row.first_name} ${row.last_name}`, already: report.already > 0 },
  };
}
