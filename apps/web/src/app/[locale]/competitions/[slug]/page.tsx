import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatTimeControl, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getTournamentBySlug, getTournamentExtras, isTbc, isUpcoming } from "@/lib/data/tournaments";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { Tbc } from "@/components/ui/tbc";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ChessClock } from "@/components/home/chess-clock";
import { IconArrow, IconCalendar, IconPin, IconClock, IconDownload } from "@/components/icons";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return {};
  return { title: t.name, description: tr(t.summary, locale) || undefined };
}

export default async function TournamentPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();
  const tt = await getTranslations("tournament");
  const [extras, session] = await Promise.all([getTournamentExtras(t.id), getSession()]);
  let myRegistration: { ticket_code: string; status: string } | null = null;
  if (session?.profile) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("registrations")
      .select("ticket_code, status")
      .eq("tournament_id", t.id)
      .eq("player_id", session.profile.id)
      .not("status", "in", "(cancelled,refused)")
      .maybeSingle();
    myRegistration = data;
  }
  const open = t.status === "registration_open";
  const upcoming = isUpcoming(t.starts_at);
  const confirmed = extras.registrants.filter((r) => r.status === "confirmed" || r.status === "pending_validation" || r.status === "pending_payment");

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: tt("date"),
      value: <span className="first-letter:uppercase">{formatDate(t.starts_at, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>,
    },
    {
      label: tt("schedule"),
      value: isTbc(t, "schedule", t.starts_at) ? <Tbc /> : formatDate(t.starts_at, locale, { hour: "2-digit", minute: "2-digit" }),
    },
    { label: tt("venue"), value: [t.venue, t.city].filter(Boolean).join(", ") || <Tbc /> },
    {
      label: tt("timeControl"),
      value: (
        <>
          {t.cadence ? tt(`cadence.${t.cadence}`) : null}
          {isTbc(t, "time_control", t.base_minutes) ? (
            <> · <Tbc /></>
          ) : (
            ` · ${formatTimeControl({ baseMinutes: t.base_minutes!, incrementSeconds: t.increment_seconds ?? 0 })}`
          )}
        </>
      ),
    },
    { label: tt("rounds"), value: isTbc(t, "rounds", t.rounds_count) ? <Tbc /> : t.rounds_count },
    { label: tt("pairingSystem"), value: isTbc(t, "pairing_system", t.pairing_system) ? <Tbc /> : tt(`system.${t.pairing_system}`) },
    {
      label: tt("fee"),
      value: isTbc(t, "fee", t.entry_fee_xof) ? <Tbc /> : t.entry_fee_xof === 0 ? tt("free") : formatXof(t.entry_fee_xof!, locale),
    },
    {
      label: tt("prizes"),
      value:
        extras.prizes.length && !t.unconfirmed_fields.includes("prizes") ? (
          <ul className="space-y-0.5">
            {extras.prizes.map((p) => (
              <li key={p.id}>
                {tr(p.label, locale)}
                {p.amount_xof != null ? ` — ${formatXof(p.amount_xof, locale)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Tbc />
        ),
    },
    { label: tt("capacity"), value: isTbc(t, "capacity", t.capacity) ? <Tbc /> : `${confirmed.length} / ${t.capacity}` },
    { label: tt("rated"), value: t.unconfirmed_fields.includes("rated") ? <Tbc /> : t.rated ? tt("ratedYes") : tt("ratedNo") },
  ];
  if (extras.partners.length) {
    facts.push({ label: tt("partners"), value: extras.partners.map((p) => p.name).join(" · ") });
  }

  return (
    <article>
      <header className="border-b border-line bg-cream/70">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 lg:px-6 lg:pt-12">
          <nav aria-label="Fil d'Ariane" className="text-sm text-stone">
            <Link href="/competitions" className="hover:text-bordeaux">
              {tt("calendarTitle")}
            </Link>
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cream">{tt(`status.${t.status}`)}</span>
            {t.edition ? <span className="text-sm font-semibold text-gold-deep">{t.edition}</span> : null}
            {t.is_demo ? <DemoBadge /> : null}
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold sm:text-5xl lg:text-6xl">{t.name}</h1>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[1.02rem]">
            <li className="flex items-center gap-2">
              <IconCalendar className="size-5 text-gold-deep" />
              <span className="first-letter:uppercase">{formatDate(t.starts_at, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </li>
            {t.venue ? (
              <li className="flex items-center gap-2">
                <IconPin className="size-5 text-gold-deep" /> {[t.venue, t.city].filter(Boolean).join(", ")}
              </li>
            ) : null}
            {t.cadence ? (
              <li className="flex items-center gap-2">
                <IconClock className="size-5 text-gold-deep" /> {tt(`cadence.${t.cadence}`)}
              </li>
            ) : null}
          </ul>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[1fr_22rem] lg:px-6">
        <div className="min-w-0 space-y-12">
          {tr(t.description, locale) ? <p className="prose-cs max-w-3xl">{tr(t.description, locale)}</p> : null}

          <section aria-labelledby="facts">
            <h2 id="facts" className="font-display text-3xl font-semibold">
              {tt("facts")}
            </h2>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {facts.map((f) => (
                <div key={f.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                  <dt className="text-sm font-semibold uppercase tracking-[0.08em] text-stone">{f.label}</dt>
                  <dd className="text-[1.02rem]">{f.value}</dd>
                </div>
              ))}
            </dl>
            {t.unconfirmed_fields.length ? <p className="mt-3 text-sm text-stone">{tt("tbcNote")}</p> : null}
            <p className="mt-2 text-sm">
              <Link href="/legal/reglement-tournois" className="font-semibold text-bordeaux hover:underline">
                {tt("rulesLink")}
              </Link>
            </p>
          </section>

          {extras.standings.length ? (
            <section aria-labelledby="results">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="results" className="font-display text-3xl font-semibold">
                  {tt("results")}
                </h2>
                <Link href={`/competitions/${t.slug}/resultats`} className="text-sm font-semibold text-bordeaux hover:underline">
                  {tt("fullResults")}
                </Link>
              </div>
              <ol className="mt-4 divide-y divide-line border-y border-line">
                {extras.standings.slice(0, 5).map((s) => (
                  <li key={s.player_id} className="flex items-center gap-4 py-2.5">
                    <span className="tabular w-7 text-right font-display text-xl text-gold-deep">{s.rank}</span>
                    <span className="flex-1 font-medium">{s.display_name}</span>
                    <span className="tabular font-semibold">{s.points}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="registrants">
            <h2 id="registrants" className="font-display text-3xl font-semibold">
              {tt("registrants")}
            </h2>
            <p className="mt-1 text-stone">
              {tt("registrantsCount", { count: confirmed.length })} · {tt("registrantsSorted")}
            </p>
            {extras.registrants.length ? (
              <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[28rem] text-left text-[0.95rem]">
                  <thead className="bg-cream/70 text-xs uppercase tracking-[0.08em] text-stone">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">{tt("player")}</th>
                      <th className="px-3 py-2 font-semibold">{tt("club")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{tt("rating")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {extras.registrants.map((r, i) => (
                      <tr key={r.registration_id}>
                        <td className="tabular px-3 py-2 text-stone">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">
                          {r.titles?.length ? <span className="mr-1.5 text-xs font-bold text-bordeaux">{r.titles.join(" ")}</span> : null}
                          {r.display_name}
                          {r.status === "waitlisted" ? <span className="ml-2 text-xs text-stone">({tt("waitlisted")})</span> : null}
                        </td>
                        <td className="px-3 py-2 text-stone">{r.club ?? ""}</td>
                        <td className="tabular px-3 py-2 text-right">{r.seed_rating ?? tt("noRating")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg bg-ink p-5 text-cream shadow-[var(--shadow-card)]">
            {upcoming ? (
              <div className="-mb-2 flex justify-center pt-3">
                <ChessClock target={t.starts_at} compact />
              </div>
            ) : null}
            {myRegistration ? (
              <>
                <p className="font-display text-2xl text-gold">{tt("registered")}</p>
                <Link href={`/billet/${myRegistration.ticket_code}`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold font-semibold text-ink hover:bg-cream">
                  {tt("seeTicket")} <IconArrow className="size-5" />
                </Link>
              </>
            ) : open ? (
              <Link
                href={`/competitions/${t.slug}/inscription`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold text-[1.05rem] font-semibold text-ink hover:bg-cream"
              >
                {tt("register")} <IconArrow className="size-5" />
              </Link>
            ) : (
              <p className="text-cream/80">{tt("registrationClosed")}</p>
            )}
            {upcoming ? (
              <a href={`/api/tournaments/${t.slug}/ics`} className="mt-3 flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-cream/85 hover:text-gold">
                <IconCalendar className="size-4" /> {tt("addToCalendar")}
              </a>
            ) : null}
            {extras.standings.length ? (
              <a href={`/api/tournaments/${t.slug}/pgn`} className="mt-3 flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-cream/85 hover:text-gold">
                <IconDownload className="size-4" /> {tt("downloadPgn")}
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </article>
  );
}
