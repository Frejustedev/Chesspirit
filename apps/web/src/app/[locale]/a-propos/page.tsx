import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PieceSvg } from "@/components/icons/pieces";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title") };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <h1 className="font-display text-5xl font-semibold">{t("title")}</h1>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            {t("visionTitle")}
          </h2>
          <p className="mt-2 font-serif text-2xl leading-snug">{t("vision")}</p>
        </section>
        <section>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            {t("missionTitle")}
          </h2>
          <p className="mt-2 font-serif text-2xl leading-snug">{t("mission")}</p>
        </section>
      </div>
      <div className="prose-cs mt-10">
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
        <p>{t("p3")}</p>
      </div>
      <div className="mt-10 flex gap-2" aria-hidden>
        {(["p", "n", "b", "r", "q", "k"] as const).map((k) => (
          <PieceSvg key={k} kind={k} color="w" className="size-12" />
        ))}
      </div>
    </article>
  );
}
