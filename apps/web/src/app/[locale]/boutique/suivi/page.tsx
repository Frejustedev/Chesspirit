import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TrackForm } from "@/components/shop/track-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("trackTitle") };
}

export default async function TrackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("trackTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("trackIntro")}</p>
      <div className="mt-6">
        <TrackForm />
      </div>
    </div>
  );
}
