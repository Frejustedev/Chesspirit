import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { qrSvg } from "@/lib/qr";
import { env } from "@/lib/env";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { IconArrow } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte");
  const t = await getTranslations("account");
  const tt = await getTranslations("tournament");
  const supabase = await createClient();
  const p = session.profile!;
  const [{ data: regs }, { data: ratings }, { data: children }] = await Promise.all([
    supabase
      .from("registrations")
      .select(
        "id, ticket_code, status, payment_status, player_id, tournaments(name, slug, starts_at)",
      )
      .not("status", "in", "(cancelled,refused)")
      .order("created_at", { ascending: false }),
    supabase.from("ratings").select("type, rating, provisional").eq("profile_id", p.id),
    supabase.from("profiles").select("id, first_name").eq("guardian_id", p.id),
  ]);
  const names = new Map([
    [p.id, p.first_name],
    ...(children ?? []).map((c) => [c.id, c.first_name] as [string, string]),
  ]);
  const card = await qrSvg(`${env.siteUrl}/membre/${p.id}`);

  return (
    <AccountShell
      nav={<AccountNav current="/compte" isAdmin={isAdminRole(session.roles)} />}
      title={t("hello", { name: p.first_name })}
    >
      <div className="grid gap-8 xl:grid-cols-[1fr_18rem]">
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-2xl font-semibold">{t("tickets")}</h2>
            {regs?.length ? (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {regs.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/billet/${r.ticket_code}`}
                      className="group flex items-center gap-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold group-hover:text-bordeaux">
                          {r.tournaments?.name}
                        </span>
                        <span className="block text-sm text-stone">
                          {r.tournaments ? formatDate(r.tournaments.starts_at, locale) : ""} ·{" "}
                          {names.get(r.player_id) ?? ""} · {t(`regStatus.${r.status}`)}
                        </span>
                      </span>
                      <IconArrow className="size-5 text-stone group-hover:text-bordeaux" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-stone">
                {t("noTickets")}{" "}
                <Link href="/competitions" className="font-semibold text-bordeaux hover:underline">
                  {t("seeCalendar")}
                </Link>
              </p>
            )}
          </section>
          <section>
            <h2 className="font-display text-2xl font-semibold">{t("ratings")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["blitz", "rapid", "classical", "online"] as const).map((k) => {
                const r = ratings?.find((x) => x.type === k);
                return (
                  <div key={k} className="rounded-[var(--radius-card)] border border-line p-3">
                    <dt className="text-sm text-stone">
                      {k === "online" ? t("online") : tt(`cadence.${k}`)}
                    </dt>
                    <dd className="tabular font-display text-3xl font-semibold">
                      {r ? r.rating : "—"}
                      {r?.provisional ? (
                        <span className="ml-1 align-top text-xs text-stone">
                          {t("provisional")}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-2 text-sm text-stone">{t("ratingsNote")}</p>
          </section>
        </div>
        <aside
          aria-labelledby="member-card"
          className="self-start rounded-lg bg-ink p-5 text-cream"
        >
          <h2
            id="member-card"
            className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gold"
          >
            {t("memberCard")}
          </h2>
          <p className="mt-2 font-display text-2xl">
            {p.first_name} {p.last_name}
          </p>
          <p className="text-sm text-cream/70">
            {[p.club_name, p.city].filter(Boolean).join(" · ")}
          </p>
          <div
            className="mx-auto mt-4 w-40 overflow-hidden rounded bg-paper p-2 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: card }}
          />
          {p.fide_id ? <p className="mt-2 text-sm text-cream/70">FIDE {p.fide_id}</p> : null}
        </aside>
      </div>
    </AccountShell>
  );
}
