import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { BookingForm } from "./booking-form";
import { onlinePaymentsEnabled } from "@/lib/payments";

export const metadata: Metadata = { robots: { index: false } };

export default async function BookOffer({
  params,
}: {
  params: Promise<{ locale: string; offerId: string }>;
}) {
  const { locale, offerId } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(offerId)) notFound();
  const session = await requireSession(locale, `/coaching/reserver/${offerId}`);
  const t = await getTranslations("coaching");
  const supabase = await createClient();
  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .eq("is_active", true)
    .maybeSingle();
  if (!offer) notFound();
  const [{ data: coach }, { data: slots }, { data: people }] = await Promise.all([
    supabase
      .from("public_coaches")
      .select("display_name, slug")
      .eq("id", offer.coach_id)
      .maybeSingle(),
    supabase
      .from("availability_slots")
      .select("id, starts_at, ends_at, modality, location, capacity, offer_id")
      .eq("coach_id", offer.coach_id)
      .eq("status", "open")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(60),
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .or(`id.eq.${session.profile!.id},guardian_id.eq.${session.profile!.id}`),
  ]);
  const usable = (slots ?? []).filter(
    (s) => (!s.offer_id || s.offer_id === offer.id) && s.modality === offer.modality,
  );
  const remaining = await Promise.all(
    usable.map(async (s) => (await supabase.rpc("slot_remaining", { p_slot_id: s.id })).data ?? 0),
  );
  const available = usable
    .map((s, i) => ({ ...s, remaining: Math.min(remaining[i]!, offer.capacity) }))
    .filter((s) => s.remaining > 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <nav className="text-sm text-stone">
        <Link href={`/coaching/coachs/${coach?.slug}`} className="hover:text-accent">
          {coach?.display_name}
        </Link>
      </nav>
      <h1 className="mt-2 font-display text-4xl font-semibold">{tr(offer.title, locale)}</h1>
      <p className="mt-2 text-stone">
        {t(`lang.${offer.language}`)} · {t(`modality.${offer.modality}`)} ·{" "}
        {t(`level.${offer.level}`)} · {t(`format.${offer.format}`)} ·{" "}
        {t("duration", { min: offer.duration_min })}
      </p>
      <p className="tabular mt-2 font-display text-3xl font-semibold">
        {offer.price_xof ? formatXof(offer.price_xof, locale) : t("free")}
      </p>
      {tr(offer.description, locale) ? (
        <p className="prose-cs mt-4">{tr(offer.description, locale)}</p>
      ) : null}
      <div className="mt-8">
        <BookingForm
          offerId={offer.id}
          slots={available.map((s) => ({
            id: s.id,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            location: s.location,
            remaining: s.remaining,
          }))}
          people={(people ?? []).map((p) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            self: p.id === session.profile!.id,
          }))}
          paid={offer.price_xof > 0}
          online={await onlinePaymentsEnabled()}
        />
      </div>
    </div>
  );
}
