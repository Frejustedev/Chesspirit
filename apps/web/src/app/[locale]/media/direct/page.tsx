import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EpisodeListPage } from "@/components/content/episode-list-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("media");
  return { title: t("live") };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ langue?: string; niveau?: string; theme?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <EpisodeListPage
      locale={locale}
      format="live"
      path="/media/direct"
      titleKey="live"
      sp={await searchParams}
    />
  );
}
