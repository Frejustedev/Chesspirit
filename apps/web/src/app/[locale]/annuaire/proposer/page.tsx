import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { ProposeForm } from "@/components/directory/directory-forms";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProposePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession(locale, "/annuaire/proposer");
  const t = await getTranslations("directory");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("proposeTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("proposeIntro")}</p>
      <div className="mt-8">
        <ProposeForm />
      </div>
    </div>
  );
}
