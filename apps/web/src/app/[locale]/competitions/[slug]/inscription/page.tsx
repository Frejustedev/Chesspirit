import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { customFieldSchema, formatDate, formatXof } from "@chesspirit/shared";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import { getTournamentBySlug } from "@/lib/data/tournaments";
import { createClient } from "@/lib/supabase/server";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { robots: { index: false } };

export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();
  const session = await requireSession(locale, `/competitions/${slug}/inscription`);
  const tr = await getTranslations("registration");
  const supabase = await createClient();
  const [{ data: people }, { data: regs }, { data: form }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, guardian_id, birth_date, sex")
      .or(`id.eq.${session.profile!.id},guardian_id.eq.${session.profile!.id}`),
    supabase
      .from("registrations")
      .select("id, player_id, ticket_code, status, payment_status")
      .eq("tournament_id", t.id),
    supabase.from("registration_forms").select("fields").eq("tournament_id", t.id).maybeSingle(),
  ]);
  const fields = z
    .array(customFieldSchema)
    .catch([])
    .parse(form?.fields ?? []);
  const feeKnown = t.entry_fee_xof != null && !t.unconfirmed_fields.includes("fee");
  const fee = feeKnown ? t.entry_fee_xof! : null;
  const online = await onlinePaymentsEnabled();
  const methods: ("online" | "on_site" | "free")[] =
    fee === 0
      ? ["free"]
      : [
          ...(fee && t.allow_online_payment && online ? (["online"] as const) : []),
          ...(t.allow_on_site_payment ? (["on_site"] as const) : []),
        ];

  const players = (people ?? []).map((p) => {
    const r = regs?.find(
      (x) => x.player_id === p.id && !["cancelled", "refused"].includes(x.status),
    );
    return {
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      self: p.id === session.profile!.id,
      registration: r ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <nav className="text-sm text-stone">
        <Link href={`/competitions/${t.slug}`} className="hover:text-accent">
          {t.name}
        </Link>
      </nav>
      <h1 className="mt-3 font-display text-4xl font-semibold">{tr("title")}</h1>
      <p className="mt-2 text-lg first-letter:uppercase">
        {t.name} ·{" "}
        {formatDate(t.starts_at, locale, { weekday: "long", day: "numeric", month: "long" })}
        {t.venue ? ` · ${t.venue}` : ""}
      </p>
      <p className="mt-1 text-stone">
        {tr("fee")} :{" "}
        {fee === null ? (
          <span className="tbc">{tr("feeTbc")}</span>
        ) : fee === 0 ? (
          tr("free")
        ) : (
          formatXof(fee, locale)
        )}
      </p>
      {t.status !== "registration_open" ? (
        <p className="mt-8 rounded bg-bordeaux-soft p-4 font-semibold text-rose">{tr("closed")}</p>
      ) : feeKnown && methods.length === 0 ? (
        <p className="mt-8 rounded bg-bordeaux-soft p-4 font-semibold text-rose">
          {tr("noMethod")}
        </p>
      ) : (
        <div className="mt-8">
          <RegistrationForm
            tournamentId={t.id}
            players={players}
            fields={fields}
            methods={methods}
            feeKnown={feeKnown}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
