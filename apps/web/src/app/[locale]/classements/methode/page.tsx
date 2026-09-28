import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RatingCalculator } from "./calculator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("method");
  return { title: t("title") };
}

export default async function MethodPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("method");
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <div className="prose-cs mt-6">
        <p>{t("p1")}</p>
        <h2>{t("formulaTitle")}</h2>
        <p>{t("p2")}</p>
      </div>
      <div
        className="my-6 rounded-lg bg-ink p-5 text-center font-serif text-xl text-cream sm:text-2xl"
        aria-label={t("formulaAria")}
      >
        <p>
          E<sub>A</sub> = 1 / (1 + 10
          <sup>
            (R<sub>B</sub> − R<sub>A</sub>) / 400
          </sup>
          )
        </p>
        <p className="mt-2">
          R′<sub>A</sub> = R<sub>A</sub> + K × (S − E<sub>A</sub>)
        </p>
      </div>
      <div className="prose-cs">
        <h2>{t("kTitle")}</h2>
        <ul>
          <li>{t("k40")}</li>
          <li>{t("k20")}</li>
          <li>{t("k10")}</li>
        </ul>
        <h2>{t("rulesTitle")}</h2>
        <ul>
          <li>{t("r1")}</li>
          <li>{t("r2")}</li>
          <li>{t("r3")}</li>
          <li>{t("r4")}</li>
          <li>{t("r5")}</li>
        </ul>
        <h2>{t("calcTitle")}</h2>
      </div>
      <RatingCalculator />
    </article>
  );
}
