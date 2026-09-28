import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { MfaForm } from "@/components/admin/mfa-form";

export const metadata: Metadata = { robots: { index: false } };

export default async function SecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  await requireSession(locale, "/admin/securite", { onboarded: false });
  const t = await getTranslations("admin");
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-4xl font-semibold">{t("mfaTitle")}</h1>
      <p className="mt-3 font-serif text-lg text-stone">{t("mfaIntro")}</p>
      <MfaForm next={safeNext(next, "/admin")} />
    </div>
  );
}
