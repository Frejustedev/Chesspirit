"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { locatePage } from "@/lib/nav";

/**
 * Mise en page des pages intérieures, comme celles du dossier de projet :
 * un titre courant en tête (« CHESSPIRIT · RUBRIQUE », page en italique à droite)
 * et un folio en pied (adresse du site, lettre de colonne de la rubrique en bordeaux).
 * L'accueil, qui est la couverture, n'en a pas.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("frame");
  const tn = useTranslations("nav");
  if (pathname === "/") return <>{children}</>;

  const { section, item, area } = locatePage(pathname);
  const place = section
    ? { href: section.href, label: tn(`sections.${section.key}`) }
    : area
      ? { href: null, label: t(`areas.${area}`) }
      : null;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6 print:hidden">
        <div className="flex items-baseline justify-between gap-6">
          <p className="label-cs truncate text-[0.75rem]">
            <Link href="/" className="hover:text-fg">
              Chesspirit
            </Link>
            {place ? (
              <>
                <span aria-hidden className="mx-2">
                  ·
                </span>
                {place.href ? (
                  <Link href={place.href} className="hover:text-fg">
                    {place.label}
                  </Link>
                ) : (
                  place.label
                )}
              </>
            ) : null}
          </p>
          {item ? (
            <p className="hidden shrink-0 font-serif italic text-stone sm:block">
              {tn(`items.${item.key}`)}
            </p>
          ) : null}
        </div>
      </div>

      {children}

      <div className="mx-auto mt-16 max-w-7xl px-4 lg:px-6 print:hidden" aria-hidden>
        <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm text-stone">
          <span>{t("site")}</span>
          {section ? (
            <span className="font-display text-lg font-semibold italic text-bordeaux">
              {section.file}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
