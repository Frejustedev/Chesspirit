import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";
import { AmbassadorForm, CopyLink, ReferralClaimForm } from "@/components/community/actions";

/** Parrainage possible dans les 30 jours suivant la création du profil (même règle qu'en base). */
const recent = (iso: string) => Date.now() - new Date(iso).getTime() < 30 * 86_400_000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.ambassadors");
  return { title: t("title"), description: t("intro") };
}

export default async function AmbassadorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.ambassadors");
  const tr_ = await getTranslations("community.referral");
  const supabase = await createClient();
  const session = await getSession();
  const me = session?.profile ?? null;
  const [{ data: approved }, { data: mine }, code, { count: referred }, { data: myReferrer }] =
    await Promise.all([
      supabase
        .from("ambassadors")
        .select("profile_id, city")
        .eq("status", "approved")
        .order("city"),
      me
        ? supabase.from("ambassadors").select("status").eq("profile_id", me.id).maybeSingle()
        : Promise.resolve({ data: null }),
      me ? supabase.rpc("my_referral_code").then((r) => r.data) : Promise.resolve(null),
      me
        ? supabase
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("referrer_id", me.id)
        : Promise.resolve({ count: 0 }),
      me
        ? supabase.from("referrals").select("id").eq("referred_id", me.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const ids = (approved ?? []).map((a) => a.profile_id);
  const { data: people } = ids.length
    ? await supabase.from("public_profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const canClaim = me && !myReferrer && recent(me.created_at);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/ambassadeurs" />
      </CommunityHeader>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("list")}</h2>
          {people?.length ? (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {(approved ?? []).map((a) => {
                const p = people.find((x) => x.id === a.profile_id);
                return p ? (
                  <li key={a.profile_id} className="flex justify-between gap-3 py-3">
                    <Link href={`/joueurs/${p.id}`} className="font-semibold hover:text-accent">
                      {p.display_name}
                    </Link>
                    <span className="text-stone">{a.city}</span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="mt-2 text-stone">{t("none")}</p>
          )}
          <h2 className="mt-10 font-display text-2xl font-semibold">{t("apply")}</h2>
          <p className="mt-1 text-stone">{t("applyIntro")}</p>
          <div className="mt-4">
            {!me ? (
              <Link
                href={`/connexion?next=${encodeURIComponent("/communaute/ambassadeurs")}`}
                className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 font-semibold text-onaccent"
              >
                {t("signIn")}
              </Link>
            ) : mine ? (
              <p className="font-semibold">{t(`status.${mine.status}`)}</p>
            ) : (
              <AmbassadorForm />
            )}
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{tr_("title")}</h2>
          <p className="mt-1 text-stone">{tr_("intro")}</p>
          {me && code ? (
            <div className="mt-4 space-y-3">
              <p className="font-semibold">{tr_("yourLink")}</p>
              <CopyLink url={`${env.siteUrl}/?parrain=${code}`} />
              <p className="text-sm">{tr_("yourCode", { code })}</p>
              <p className="font-semibold">{tr_("count", { n: referred ?? 0 })}</p>
            </div>
          ) : null}
          {canClaim ? (
            <div className="mt-8">
              <h3 className="font-semibold">{tr_("haveCode")}</h3>
              <div className="mt-2">
                <ReferralClaimForm />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
