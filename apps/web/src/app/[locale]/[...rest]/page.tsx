import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ALL_NAV_HREFS, NAV } from "@/lib/nav";
import { PieceSvg } from "@/components/icons/pieces";

/** Rubriques de l'arborescence pas encore ouvertes : page « en préparation » (sinon 404). */
function lookup(href: string) {
  for (const s of NAV) {
    if (s.href === href) return { section: s.key, item: null as string | null };
    const i = s.items.find((x) => x.href === href);
    if (i) return { section: s.key, item: i.key };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rest: string[] }>;
}): Promise<Metadata> {
  const href = `/${(await params).rest.join("/")}`;
  const hit = lookup(href);
  if (!hit) return { robots: { index: false } };
  const t = await getTranslations("nav");
  return {
    title: hit.item ? t(`items.${hit.item}`) : t(`sections.${hit.section}`),
    robots: { index: false },
  };
}

export default async function ComingSoon({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const { locale, rest } = await params;
  setRequestLocale(locale);
  const href = `/${rest.join("/")}`;
  const hit = lookup(href);
  if (!hit || !ALL_NAV_HREFS.has(href)) notFound();
  const t = await getTranslations();
  const section = NAV.find((s) => s.key === hit.section)!;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-6">
      <PieceSvg kind="n" color="w" className="mx-auto size-20" />
      <p className="mt-6 font-sans text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">
        {t(`nav.sections.${hit.section}`)}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
        {hit.item ? t(`nav.items.${hit.item}`) : t(`nav.sections.${hit.section}`)}
      </h1>
      <p className="mx-auto mt-4 max-w-xl font-serif text-xl text-stone">
        {t("common.comingSoonText")}
      </p>
      <ul className="mt-10 flex flex-wrap justify-center gap-2">
        {section.items
          .filter((i) => i.href !== href)
          .map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 hover:border-bordeaux hover:text-bordeaux"
              >
                {t(`nav.items.${i.key}`)}
              </Link>
            </li>
          ))}
      </ul>
      <Link
        href="/"
        className="mt-10 inline-flex min-h-11 items-center font-semibold text-bordeaux hover:underline"
      >
        {t("common.backHome")}
      </Link>
    </div>
  );
}
