import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const ITEMS = [
  ["/annuaire/joueurs", "players"],
  ["/annuaire/entraineurs", "coaches"],
  ["/annuaire/arbitres", "arbiters"],
  ["/annuaire/clubs", "structures"],
  ["/annuaire/carte", "map"],
  ["/annuaire/emplois", "jobs"],
] as const;

export async function DirectoryNav({ current }: { current: string }) {
  const t = await getTranslations("directory");
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

/** Filtres communs : recherche, département, ville (formulaire GET, sans JavaScript). */
export async function DirectoryFilters({
  base,
  q,
  dep,
  extra,
}: {
  base: string;
  q?: string;
  dep?: string;
  extra?: React.ReactNode;
}) {
  const t = await getTranslations("directory");
  const { BENIN_DEPARTMENTS } = await import("@chesspirit/shared");
  return (
    <form action={base} className="mt-6 flex flex-wrap gap-2">
      <label htmlFor="d-q" className="sr-only">
        {t("search")}
      </label>
      <input
        id="d-q"
        name="q"
        defaultValue={q}
        placeholder={t("search")}
        className="min-h-11 min-w-0 basis-full rounded-md border border-line bg-field px-3 sm:flex-1 sm:basis-auto"
      />
      <label htmlFor="d-dep" className="sr-only">
        {t("department")}
      </label>
      <select
        id="d-dep"
        name="dep"
        defaultValue={dep ?? ""}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 sm:flex-none"
      >
        <option value="">{t("allDepartments")}</option>
        {BENIN_DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {extra}
      <button
        type="submit"
        className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
      >
        {t("apply")}
      </button>
    </form>
  );
}

export const cleanQuery = (q?: string) =>
  (q ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[%_,()*]/g, " ")
    .trim()
    .slice(0, 60);
