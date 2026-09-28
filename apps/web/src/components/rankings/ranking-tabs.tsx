import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Bascule entre la cote Chesspirit et l'Elo FIDE officiel. */
export async function RankingTabs({ current }: { current: "chesspirit" | "fide" }) {
  const t = await getTranslations("rankings");
  const tabs = [
    { key: "chesspirit", href: "/classements", label: t("tabChesspirit") },
    { key: "fide", href: "/classements/fide", label: t("tabFide") },
  ] as const;
  return (
    <nav
      aria-label={t("tabs")}
      className="mb-6 inline-grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold sm:px-5 ${tab.key === current ? "bg-gold text-onaccent" : "text-fg/80 hover:text-accent"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
