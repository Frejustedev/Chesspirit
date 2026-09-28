import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const ITEMS = [
  ["/communaute/adhesion", "membership"],
  ["/communaute/badges", "badges"],
  ["/communaute/ambassadeurs", "ambassadors"],
  ["/communaute/pronostics", "predictions"],
  ["/communaute/public-contre-le-maitre", "pvm"],
  ["/communaute/awards", "awards"],
] as const;

export async function CommunityNav({ current }: { current: string }) {
  const t = await getTranslations("community");
  return (
    <nav aria-label={t("title")} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {ITEMS.map(([href, key]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={current === href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${current === href ? "bg-gold text-onaccent" : "border border-line hover:bg-surface"}`}
            >
              {t(`nav.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CommunityHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
      {intro ? <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </>
  );
}
