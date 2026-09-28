import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BASE_PUZZLES } from "@/lib/puzzles";
import { PlacementTest } from "./placement-test";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placement");
  return { title: t("title") };
}

export default async function PlacementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("placement");
  // Du plus simple au plus difficile : mats en 1 puis mats en 2.
  // Série fixe de cinq positions graduées (la base de puzzles s'enrichit sans changer le test).
  const SERIES = ["back-rank", "scholar", "back-rank-2", "philidor", "philidor-black"];
  const series = SERIES.map((id) => BASE_PUZZLES.find((p) => p.id === id)!).filter(Boolean);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("intro", { n: series.length })}</p>
      <div className="mt-8">
        <PlacementTest puzzles={series} />
      </div>
    </div>
  );
}
