import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuoteForm } from "./quote-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quote");
  return { title: t("title") };
}

export default async function SchoolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quote");
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[1fr_1.2fr] lg:px-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-3 font-serif text-xl text-stone">{t("intro")}</p>
        <ul className="prose-cs mt-6">
          <li>{t("p1")}</li>
          <li>{t("p2")}</li>
          <li>{t("p3")}</li>
          <li>{t("p4")}</li>
        </ul>
      </div>
      <QuoteForm />
    </div>
  );
}
