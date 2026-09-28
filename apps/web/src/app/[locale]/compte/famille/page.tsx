import { enabledCountries } from "@/lib/countries";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/account/profile-form";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { formatDate } from "@chesspirit/shared";

export const metadata: Metadata = { robots: { index: false } };

export default async function FamilyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const countries = await enabledCountries(locale);
  const session = await requireSession(locale, "/compte/famille");
  const t = await getTranslations("family");
  const supabase = await createClient();
  const { data: children } = await supabase
    .from("profiles")
    .select("*")
    .eq("guardian_id", session.profile!.id)
    .order("birth_date");
  return (
    <AccountShell
      nav={<AccountNav current="/compte/famille" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <p className="max-w-2xl font-serif text-lg text-stone">{t("intro")}</p>
      {children?.length ? (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {children.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-semibold">
                {c.first_name} {c.last_name}
              </span>
              <span className="text-sm text-stone">
                {c.birth_date ? formatDate(c.birth_date, locale) : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-stone">{t("none")}</p>
      )}
      <h2 className="mt-10 font-display text-2xl font-semibold">{t("add")}</h2>
      <div className="mt-4">
        <ProfileForm
          countries={countries}
          mode="child"
          defaults={{
            city: session.profile!.city ?? undefined,
            last_name: session.profile!.last_name,
          }}
        />
      </div>
    </AccountShell>
  );
}
