"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Chess } from "chess.js";
import {
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
        : t.starts_at.slice(0, 10),
      cadence: t.cadence,
      source: "upload" as const,
      validated_by: session?.userId ?? null,
      validated_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("games").insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { imported: rows.length, rejected, linked } };
}

const settingsSchema = tournamentSchema.omit({ starts_at: true }).extend({
  starts_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
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
  // Heure locale de Porto-Novo (UTC+1) ; sans heure, le tournoi est daté du jour à minuit et les horaires restent « À confirmer ».
  const time = v.starts_time || "00:00";
  const startsAt = new Date(`${v.starts_date}T${time}:00+01:00`).toISOString();
  const unconfirmed = new Set(v.unconfirmed_fields);
  if (!v.starts_time) unconfirmed.add("schedule");
  const row = {
    name: v.name,
    slug: v.slug,
    edition: v.edition || null,
    venue: v.venue || null,
    city: v.city || null,
    starts_at: startsAt,
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
