import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { activeMemberships } from "@/lib/membership";
import { tr } from "@/lib/i18n-json";
import { qrSvg } from "@/lib/qr";
import { env } from "@/lib/env";
import { Tbc } from "@/components/ui/tbc";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { MembershipButton } from "@/components/community/actions";
import { onlinePaymentsEnabled } from "@/lib/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.membership");
  return { title: t("title"), description: t("intro") };
}

export default async function MembershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.membership");
  const tc = await getTranslations("community");
  const supabase = await createClient();
  const session = await getSession();
  const me = session?.profile ?? null;
  const [{ data: plans }, active, { data: pending }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_xof", { nullsFirst: false }),
    me ? activeMemberships(me.id) : Promise.resolve([]),
    me
      ? supabase
          .from("memberships")
          .select("id, plan")
          .eq("profile_id", me.id)
          .eq("status", "pending_payment")
      : Promise.resolve({ data: [] as { id: string; plan: string }[] }),
  ]);
  const current = active.find((m) => m.plan === "premium") ?? active[0] ?? null;
  const card = current ? await qrSvg(`${env.siteUrl}/membre/${current.card_number}`) : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/adhesion" />
      </CommunityHeader>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="grid gap-4 sm:grid-cols-2">
          {(plans ?? []).map((p) => {
            const mine = active.some((m) => m.plan === p.code);
            const waiting = pending?.some((m) => m.plan === p.code);
            return (
              <li
                key={p.code}
                className="flex flex-col rounded-[var(--radius-card)] border border-line p-5"
              >
                <h2 className="font-display text-2xl font-semibold">{tr(p.name, locale)}</h2>
                <p className="mt-1 text-lg font-semibold">
                  {p.price_xof === null ? (
                    <Tbc />
                  ) : p.price_xof === 0 ? (
                    t("free")
                  ) : (
                    t("price", {
                      price: formatXof(p.price_xof, locale),
                      months: p.duration_months ?? 12,
                    })
                  )}
                </p>
                <p className="mt-2 text-stone">{tr(p.description, locale)}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {((p.benefits as { fr: string; en: string }[]) ?? []).map((b, i) => (
                    <li key={i}>{tr(b, locale)}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  {mine ? (
                    <p className="font-semibold text-success">{t("active")}</p>
                  ) : p.price_xof === null ? (
                    <p className="text-sm text-stone">{t("priceTbc")}</p>
                  ) : !me ? (
                    <Link
                      href={`/connexion?next=${encodeURIComponent("/communaute/adhesion")}`}
                      className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-cream"
                    >
                      {t("signIn")}
                    </Link>
                  ) : (
                    <MembershipButton
                      plan={p.code as "free" | "premium"}
                      label={
                        waiting ? t("pay") : p.price_xof === 0 ? t("joinFree") : t("joinPremium")
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {current && card ? (
          <aside
            aria-labelledby="card-title"
            className="self-start rounded-lg bg-ink p-5 text-cream"
          >
            <h2
              id="card-title"
              className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-gold"
            >
              {t("card")}
            </h2>
            <p className="mt-2 font-display text-2xl">
              {me!.first_name} {me!.last_name}
            </p>
            <p className="tabular text-sm text-cream/80">
              {current.card_number} ·{" "}
              {tr(plans?.find((p) => p.code === current.plan)?.name ?? null, locale)}
            </p>
            <p className="text-sm text-cream/70">
              {current.ends_on
                ? t("validUntil", { date: formatDate(current.ends_on, locale) })
                : t("noEnd")}
            </p>
            <div
              className="mx-auto mt-4 w-40 overflow-hidden rounded bg-paper p-2 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: card }}
            />
            <p className="mt-2 text-center text-xs text-cream/70">{t("cardHelp")}</p>
          </aside>
        ) : null}
      </div>
      <p className="mt-8 text-sm text-stone">
        {(await onlinePaymentsEnabled()) ? tc("membership.note") : tc("membership.noteSoon")}
      </p>
    </div>
  );
}
