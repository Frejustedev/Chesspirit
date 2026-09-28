import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const ITEMS = [
  ["/academie/lecons", "lessons"],
  ["/academie/puzzle-du-jour", "puzzle"],
  ["/academie/ressources", "resources"],
  ["/academie/lexique", "lexicon"],
  ["/academie/premium", "premium"],
] as const;

export async function AcademyNav({ current }: { current: string }) {
  const t = await getTranslations("academy");
  return (
    <nav aria-label={t("title")} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {ITEMS.map(([href, key]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={current === href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${current === href ? "bg-ink text-cream" : "border border-line hover:bg-cream"}`}
            >
              {t(`nav.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
