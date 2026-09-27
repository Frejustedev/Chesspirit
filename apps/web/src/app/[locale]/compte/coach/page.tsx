import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { redirect } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import {
  CoachProfileForm,
  OfferForm,
  SlotForm,
  SlotClose,
  BookingStatus,
  FollowUpForm,
} from "@/components/coaching/coach-forms";

export const metadata: Metadata = { robots: { index: false } };

export default async function CoachSpace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/coach");
  const supabase = await createClient();
  const { data: coach } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("profile_id", session.profile!.id)
    .maybeSingle();
  if (!coach) redirect({ href: "/coaching/devenir-coach", locale });
  const t = await getTranslations("coachSpace");
  const tc = await getTranslations("coaching");
  const [{ data: offers }, { data: slots }, { data: bookings }, { data: payouts }] =
    await Promise.all([
      supabase.from("offers").select("*").eq("coach_id", coach!.id).order("created_at"),
      supabase
        .from("availability_slots")
        .select("*")
        .eq("coach_id", coach!.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(50),
      supabase
        .from("bookings")
        .select(
          "id, status, amount_xof, commission_xof, student_id, offers(title), availability_slots(starts_at), profiles!bookings_student_id_fkey(first_name, last_name)",
        )
        .eq("coach_id", coach!.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payouts")
        .select("*")
        .eq("coach_id", coach!.id)
        .order("period_end", { ascending: false }),
    ]);
  const earned = (bookings ?? []).filter((b) => ["confirmed", "completed"].includes(b.status));
  const gross = earned.reduce((a, b) => a + b.amount_xof, 0);
  const commission = earned.reduce((a, b) => a + b.commission_xof, 0);
  const students = new Map<string, string>();
  for (const b of bookings ?? [])
    if (b.profiles) students.set(b.student_id, `${b.profiles.first_name} ${b.profiles.last_name}`);

  return (
    <AccountShell
      nav={<AccountNav current="/compte/coach" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      {coach!.status !== "approved" ? (
        <p className="mb-6 rounded bg-gold-soft/60 p-3 font-semibold">
          {t(`status.${coach!.status}`)}
        </p>
      ) : null}
      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-card)] border border-line p-3">
          <dt className="text-sm text-stone">{t("gross")}</dt>
          <dd className="tabular font-display text-2xl font-semibold">
            {formatXof(gross, locale)}
          </dd>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line p-3">
          <dt className="text-sm text-stone">{t("commission")}</dt>
          <dd className="tabular font-display text-2xl font-semibold">
            {formatXof(commission, locale)}
          </dd>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line p-3">
          <dt className="text-sm text-stone">{t("net")}</dt>
          <dd className="tabular font-display text-2xl font-semibold">
            {formatXof(gross - commission, locale)}
          </dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("bookings")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(bookings ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : "—"}
                </span>
                <span className="block text-sm text-stone">
                  {tr(b.offers?.title ?? null, locale)} ·{" "}
                  {b.availability_slots
                    ? formatDateTime(b.availability_slots.starts_at, locale)
                    : ""}{" "}
                  · {t(`bstatus.${b.status}`)}
                </span>
              </span>
              {b.status === "confirmed" ? <BookingStatus id={b.id} /> : null}
            </li>
          ))}
          {!bookings?.length ? <li className="py-2 text-stone">{t("noBookings")}</li> : null}
        </ul>
      </section>

      {students.size ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("students")}</h2>
          <FollowUpForm students={[...students].map(([id, name]) => ({ id, name }))} />
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("slots")}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(slots ?? []).map((s) => (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${s.status === "open" ? "border-line" : "border-line opacity-50"}`}
            >
              {formatDateTime(s.starts_at, locale)} · {tc(`modality.${s.modality}`)}
              {s.status === "open" ? <SlotClose id={s.id} /> : null}
            </li>
          ))}
        </ul>
        <SlotForm />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("offers")}</h2>
        <ul className="mt-3 space-y-3">
          {(offers ?? []).map((o) => (
            <li key={o.id}>
              <OfferForm
                offer={{
                  id: o.id,
                  title_fr: tr(o.title, "fr"),
                  description_fr: tr(o.description, "fr"),
                  language: o.language,
                  modality: o.modality,
                  level: o.level,
                  format: o.format,
                  duration_min: o.duration_min,
                  price_xof: o.price_xof,
                  capacity: o.capacity,
                  is_active: o.is_active,
                }}
              />
            </li>
          ))}
          <li>
            <OfferForm offer={null} />
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("profile")}</h2>
        <CoachProfileForm
          c={{
            headline_fr: tr(coach!.headline, "fr"),
            bio_fr: tr(coach!.bio, "fr"),
            languages: coach!.languages,
            modalities: coach!.modalities,
            levels: coach!.levels,
            city: coach!.city ?? "",
            specialties: coach!.specialties.join(", "),
          }}
        />
      </section>

      {payouts?.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("payouts")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>
                  {p.period_start} → {p.period_end}
                </span>
                <span className="tabular font-semibold">
                  {formatXof(p.net_xof, locale)} · {t(`payout.${p.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AccountShell>
  );
}
