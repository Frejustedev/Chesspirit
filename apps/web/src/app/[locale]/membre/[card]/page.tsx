import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Vérification d'une carte de membre (QR code) : validité seulement. Les numéros se suivent :
 * le nom n'est affiché que pour un profil public (initiale du nom pour les mineurs).
 */
export default async function MemberCheck({
  params,
}: {
  params: Promise<{ locale: string; card: string }>;
}) {
  const { locale, card } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.membership");
  const valid = /^CSP-\d{6}$/.test(card);
  const db = createAdminClient();
  const { data: m } = valid
    ? await db
        .from("memberships")
        .select("plan, status, ends_on, profiles(first_name, last_name, is_minor, is_public)")
        .eq("card_number", card)
        .maybeSingle()
    : { data: null };
  const today = new Date().toISOString().slice(0, 10);
  const ok = !!m && m.status === "active" && (!m.ends_on || m.ends_on >= today);
  const p = m?.profiles;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-4xl font-semibold">{t("checkTitle")}</h1>
      <p className="tabular mt-2 text-stone">{valid ? card : "—"}</p>
      <p
        className={`mt-6 rounded-lg p-5 text-xl font-semibold ${ok ? "bg-success/10 text-success" : "bg-bordeaux/10 text-bordeaux"}`}
      >
        {ok ? t("cardValid") : t("cardInvalid")}
      </p>
      {ok && p ? (
        <p className="mt-4 font-display text-2xl">
          {p.is_public
            ? `${p.first_name} ${p.is_minor ? `${p.last_name.slice(0, 1)}.` : p.last_name}`
            : t("privateName")}
          <span className="mt-1 block font-sans text-base text-stone">
            {m!.plan === "premium" ? t("premiumMember") : t("member")}
            {m!.ends_on ? ` · ${t("validUntil", { date: formatDate(m!.ends_on, locale) })}` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}
