import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { JobForm } from "@/components/directory/directory-forms";

export const metadata: Metadata = { robots: { index: false } };

export default async function PostJobPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession(locale, "/annuaire/emplois/publier");
  const t = await getTranslations("directory");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("postJobTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("postJobIntro")}</p>
      <div className="mt-8">
        <JobForm />
      </div>
    </div>
  );
}
