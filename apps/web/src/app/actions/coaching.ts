"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { startPayment } from "@/lib/payments/checkout";
import { bookingConfirmation } from "@/lib/coaching/notify";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const LEVELS = ["discovery", "beginner", "intermediate", "advanced", "competition"] as const;

export async function bookAction(input: {
  slotId: string;
  offerId: string;
  studentId: string;
  notes?: string;
}): Promise<Result<{ redirect: string }>> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  if (![input.slotId, input.offerId, input.studentId].every((x) => uuid.safeParse(x).success))
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: b, error } = await supabase.rpc("book_slot", {
    p_slot_id: input.slotId,
    p_offer_id: input.offerId,
    p_student_id: input.studentId,
    p_notes: input.notes?.slice(0, 1000) ?? undefined,
  });
  if (error || !b) return { ok: false, error: error?.message ?? "server" };
  if (b.status === "pending_payment") {
    const { data: o } = await supabase.from("offers").select("title").eq("id", b.offer_id).single();
    try {
      const url = await startPayment({
        objectType: "booking",
        objectId: b.id,
        amountXof: b.amount_xof,
        description: `Cours — ${(o?.title as Record<string, string> | null)?.fr ?? "Chesspirit"}`,
        userId: session.userId,
        payer: {
          profileId: b.student_id,
          firstName: session.profile.first_name,
          lastName: session.profile.last_name,
          email: session.profile.email,
          phone: session.profile.phone,
        },
      });
      return { ok: true, data: { redirect: url } };
    } catch {
      return { ok: false, error: "payment_unavailable" };
    }
  }
  await bookingConfirmation(b.id);
  return { ok: true, data: { redirect: "/compte/cours" } };
}

export async function cancelBookingAction(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/cours");
  revalidatePath("/compte/coach");
  return { ok: true };
}

const applicationSchema = z.object({
  experience: z.string().trim().min(20).max(4000),
  languages: z.array(z.enum(["fr", "en", "fon"])).min(1),
  modalities: z.array(z.enum(["in_person", "online"])).min(1),
  city: z.string().trim().max(80).optional(),
  credentials_note: z.string().trim().max(1000).optional(),
});

export async function applyCoachAction(raw: unknown): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const p = applicationSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_applications")
    .insert({ ...p.data, profile_id: session.profile.id });
  return error ? { ok: false, error: error.message } : { ok: true };
}

const quoteSchema = z.object({
  kind: z.enum(["school", "company", "club", "event", "group_order", "rental"]),
  organization: z.string().trim().min(2).max(160),
  contact_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  participants: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  message: z.string().trim().max(4000).optional(),
  website: z.string().max(0).optional().or(z.literal("")),
});

export async function quoteAction(_prev: unknown, form: FormData): Promise<Result> {
  const p = quoteSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const { website, ...v } = p.data;
  if (website) return { ok: true };
  if (!v.phone && !v.email) return { ok: false, error: "contact_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_requests")
    .insert({ ...v, phone: v.phone || null, email: v.email || null });
  return error ? { ok: false, error: "server" } : { ok: true };
}

/** Test de niveau : score → niveau recommandé (enregistré si l'utilisateur est connecté). */
export async function placementAction(
  score: number,
  total: number,
  answers: boolean[],
): Promise<Result<{ level: (typeof LEVELS)[number] }>> {
  if (
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total < 1 ||
    score < 0 ||
    score > total
  )
    return { ok: false, error: "invalid" };
  const ratio = score / total;
  const level =
    ratio < 0.2
      ? "discovery"
      : ratio < 0.45
        ? "beginner"
        : ratio < 0.7
          ? "intermediate"
          : ratio < 0.9
            ? "advanced"
            : "competition";
  const session = await getSession();
  if (session?.profile) {
    const supabase = await createClient();
    await supabase
      .from("placement_results")
      .insert({
        profile_id: session.profile.id,
        score,
        total,
        level,
        answers: answers.slice(0, 50),
      });
  }
  return { ok: true, data: { level } };
}

// --- Espace coach -------------------------------------------------------------

const offerSchema = z.object({
  id: z.string().uuid().optional(),
  title_fr: z.string().trim().min(3).max(120),
  title_en: z.string().trim().max(120).optional(),
  description_fr: z.string().trim().max(2000).optional(),
  language: z.enum(["fr", "en", "fon"]),
  modality: z.enum(["in_person", "online"]),
  level: z.enum(LEVELS),
  format: z.enum(["individual", "group"]),
  duration_min: z.coerce.number().int().min(15).max(480),
  price_xof: z.coerce.number().int().min(0).max(10_000_000),
  capacity: z.coerce.number().int().min(1).max(60),
  is_active: z.boolean().default(true),
});

async function myCoachId() {
  const supabase = await createClient();
  const session = await getSession();
  if (!session?.profile) return { supabase, coachId: null };
  const { data } = await supabase
    .from("coach_profiles")
    .select("id")
    .eq("profile_id", session.profile.id)
    .maybeSingle();
  return { supabase, coachId: data?.id ?? null };
}

export async function saveOfferAction(raw: unknown): Promise<Result> {
  const p = offerSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, coachId } = await myCoachId();
  if (!coachId) return { ok: false, error: "forbidden" };
  const v = p.data;
  const row = {
    coach_id: coachId,
    title: { fr: v.title_fr, en: v.title_en || v.title_fr },
    description: { fr: v.description_fr ?? "", en: "" },
    language: v.language,
    modality: v.modality,
    level: v.level,
    format: v.format,
    duration_min: v.duration_min,
    price_xof: v.price_xof,
    capacity: v.format === "individual" ? 1 : v.capacity,
    is_active: v.is_active,
  };
  const { error } = v.id
    ? await supabase.from("offers").update(row).eq("id", v.id)
    : await supabase.from("offers").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true };
}

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  duration_min: z.coerce.number().int().min(15).max(480),
  modality: z.enum(["in_person", "online"]),
  location: z.string().trim().max(200).optional(),
  capacity: z.coerce.number().int().min(1).max(60),
  repeat_weeks: z.coerce.number().int().min(1).max(12).default(1),
});

export async function addSlotsAction(raw: unknown): Promise<Result<number>> {
  const p = slotSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, coachId } = await myCoachId();
  if (!coachId) return { ok: false, error: "forbidden" };
  const v = p.data;
  const base = new Date(`${v.date}T${v.start}:00+01:00`).getTime();
  const rows = Array.from({ length: v.repeat_weeks }, (_, i) => {
    const s = base + i * 7 * 86400000;
    return {
      coach_id: coachId,
      starts_at: new Date(s).toISOString(),
      ends_at: new Date(s + v.duration_min * 60000).toISOString(),
      modality: v.modality,
      location: v.location || null,
      capacity: v.capacity,
    };
  }).filter((r) => Date.parse(r.starts_at) > Date.now());
  if (!rows.length) return { ok: false, error: "past_date" };
  const { error } = await supabase.from("availability_slots").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true, data: rows.length };
}

export async function closeSlotAction(id: string): Promise<Result> {
  const { supabase } = await myCoachId();
  const { error } = await supabase
    .from("availability_slots")
    .update({ status: "closed" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true };
}

export async function completeBookingAction(
  id: string,
  status: "completed" | "no_show",
): Promise<Result> {
  const { supabase } = await myCoachId();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true };
}

export async function addFollowUpAction(input: {
  studentId: string;
  kind: "note" | "homework";
  text: string;
  due?: string;
  replayUrl?: string;
}): Promise<Result> {
  const { supabase, coachId } = await myCoachId();
  if (!coachId || !uuid.safeParse(input.studentId).success || !input.text.trim())
    return { ok: false, error: "invalid" };
  const { error } =
    input.kind === "note"
      ? await supabase.from("progress_notes").insert({
          coach_id: coachId,
          student_id: input.studentId,
          note: input.text.slice(0, 4000),
          replay_url:
            input.replayUrl && /^https:\/\//.test(input.replayUrl) ? input.replayUrl : null,
        })
      : await supabase.from("homework").insert({
          coach_id: coachId,
          student_id: input.studentId,
          title: input.text.slice(0, 200),
          due_on: input.due && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : null,
        });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true };
}

export async function homeworkDoneAction(id: string, done: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("homework")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/cours");
  return { ok: true };
}

export async function updateCoachProfileAction(raw: unknown): Promise<Result> {
  const p = z
    .object({
      headline_fr: z.string().trim().max(160),
      bio_fr: z.string().trim().max(4000),
      languages: z.array(z.enum(["fr", "en", "fon"])).min(1),
      modalities: z.array(z.enum(["in_person", "online"])).min(1),
      levels: z.array(z.enum(LEVELS)),
      city: z.string().trim().max(80).optional(),
      specialties: z.string().trim().max(300).optional(),
    })
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, coachId } = await myCoachId();
  if (!coachId) return { ok: false, error: "forbidden" };
  const v = p.data;
  const { error } = await supabase
    .from("coach_profiles")
    .update({
      headline: { fr: v.headline_fr, en: v.headline_fr },
      bio: { fr: v.bio_fr, en: v.bio_fr },
      languages: v.languages,
      modalities: v.modalities,
      levels: v.levels,
      city: v.city || null,
      specialties: (v.specialties ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12),
    })
    .eq("id", coachId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compte/coach");
  return { ok: true };
}

// --- Administration -------------------------------------------------------------

export async function approveApplicationAction(id: string, approve: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = approve
    ? await supabase.rpc("approve_coach_application", { p_application_id: id })
    : await supabase.from("coach_applications").update({ status: "refused" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coaching");
  return { ok: true };
}

export async function setCoachStatusAction(
  id: string,
  status: "approved" | "suspended",
  team: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profiles")
    .update({ status, is_chesspirit: team })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coaching");
  return { ok: true };
}
