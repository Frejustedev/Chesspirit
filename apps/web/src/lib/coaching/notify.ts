import "server-only";
import { formatDateTime } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

/** Confirmation de réservation d'un cours (SMS et e-mail, factices sans clé). */
export async function bookingConfirmation(bookingId: string) {
  const db = createAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select(
      "id, meeting_url, student_id, availability_slots(starts_at, location), profiles!bookings_student_id_fkey(phone, email, first_name)",
    )
    .eq("id", bookingId)
    .single();
  if (!b?.profiles || !b.availability_slots) return;
  const where = b.meeting_url
    ? ` — visio : ${b.meeting_url}`
    : b.availability_slots.location
      ? ` — ${b.availability_slots.location}`
      : "";
  const text = `Chesspirit : cours réservé pour ${b.profiles.first_name} le ${formatDateTime(b.availability_slots.starts_at)}${where}.`;
  await notify([
    ...(b.profiles.phone
      ? [
          {
            profileId: b.student_id,
            channel: "sms" as const,
            to: b.profiles.phone,
            template: "booking_confirmed",
            text,
          },
        ]
      : []),
    ...(b.profiles.email
      ? [
          {
            profileId: b.student_id,
            channel: "email" as const,
            to: b.profiles.email,
            template: "booking_confirmed",
            subject: "Cours réservé",
            text,
          },
        ]
      : []),
  ]).catch(() => undefined);
}
