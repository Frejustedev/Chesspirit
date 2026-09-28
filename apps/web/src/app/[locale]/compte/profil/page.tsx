import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession, isAdminRole } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { ProfileForm } from "@/components/account/profile-form";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import type { ProfileInput } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { lichessFake } from "@/lib/lichess";
import { LichessLink } from "@/components/account/lichess-link";
import { ArbiterForm } from "@/components/directory/directory-forms";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; lichess?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, lichess } = await searchParams;
  const session = await requireSession(locale, "/compte/profil", { onboarded: false });
  const t = await getTranslations("profile");
  const p = session.profile;
  const defaults = p
    ? ({
        first_name: p.first_name,
        last_name: p.last_name,
        birth_date: p.birth_date ?? undefined,
        sex: p.sex ?? undefined,
        city: p.city ?? undefined,
        department: (p.department ?? undefined) as ProfileInput["department"],
        club_name: p.club_name ?? undefined,
        fide_id: p.fide_id ?? undefined,
      } as Partial<ProfileInput>)
    : undefined;

  if (!p?.onboarded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <h1 className="font-display text-4xl font-semibold">{t("welcomeTitle")}</h1>
        <p className="mt-3 font-serif text-xl text-stone">{t("welcomeText")}</p>
        <div className="mt-8">
          <ProfileForm mode="onboarding" defaults={defaults} next={safeNext(next)} />
        </div>
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: linked }, { data: arbiter }] = await Promise.all([
    supabase.from("lichess_accounts").select("username").eq("profile_id", p.id).maybeSingle(),
    supabase
      .from("arbiter_profiles")
      .select("title, zone, availability, languages, is_public")
      .eq("profile_id", p.id)
      .maybeSingle(),
  ]);
  return (
    <AccountShell
      nav={<AccountNav current="/compte/profil" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <ProfileForm mode="edit" defaults={defaults} />
      <div className="mt-10">
        <LichessLink username={linked?.username ?? null} fake={lichessFake()} status={lichess} />
      </div>
      {!p.is_minor ? (
        <div className="mt-10">
          <ArbiterForm
            initial={
              arbiter
                ? {
                    title: arbiter.title ?? "",
                    zone: arbiter.zone ?? "",
                    availability: arbiter.availability ?? "",
                    languages: arbiter.languages,
                    is_public: arbiter.is_public,
                  }
                : null
            }
          />
        </div>
      ) : null}
    </AccountShell>
  );
}
