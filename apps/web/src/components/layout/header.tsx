import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { IconAccount, IconBag, IconSearch, IconChevronDown } from "@/components/icons";
import { NAV } from "@/lib/nav";
import { getSession } from "@/lib/auth";
import { getNextEvent } from "@/lib/data/tournaments";
import { MobileMenu } from "./mobile-menu";
import { LocaleSwitch } from "./locale-switch";

export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const [session, next] = await Promise.all([getSession(), getNextEvent()]);
  const cta =
    next && ["registration_open", "published"].includes(next.status)
      ? { href: `/competitions/${next.slug}`, label: t("ctaTournament") }
      : { href: "/coaching/reserver", label: t("ctaCoaching") };
  const sections = NAV.map((s) => ({
    key: s.key,
    href: s.href,
    label: t(`sections.${s.key}`),
    items: s.items.map((i) => ({ href: i.href, label: t(`items.${i.key}`) })),
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-cream"
      >
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:h-[72px] lg:px-6">
        <MobileMenu
          sections={sections}
          labels={{ open: tc("openMenu"), close: tc("closeMenu"), account: t("account"), cta: cta.label }}
          ctaHref={cta.href}
        />
        <Link href="/" className="shrink-0 text-[1.65rem] leading-none lg:text-[1.8rem]" aria-label={tc("home")}>
          <Logo />
        </Link>

        <nav aria-label={t("main")} className="ml-4 hidden flex-1 xl:block">
          <ul className="flex items-center gap-0.5">
            {sections.map((s) => (
              <li key={s.key} className="group relative">
                <Link
                  href={s.href}
                  className="flex min-h-11 items-center gap-1 whitespace-nowrap rounded px-2 text-[0.95rem] font-medium text-ink/85 transition-colors hover:text-bordeaux"
                >
                  {s.label}
                  <IconChevronDown className="size-3.5 opacity-60 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
                </Link>
                <div className="invisible absolute left-0 top-full z-50 min-w-60 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <ul className="rounded-[var(--radius-card)] border border-line bg-paper p-2 shadow-[var(--shadow-card)]">
                    {s.items.map((i) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          className="flex min-h-11 items-center rounded px-3 text-[0.95rem] text-ink/85 hover:bg-cream hover:text-bordeaux"
                        >
                          {i.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/recherche"
            className="grid size-11 place-items-center rounded-full text-ink/80 hover:bg-cream hover:text-bordeaux"
            aria-label={t("search")}
          >
            <IconSearch className="size-[22px]" />
          </Link>
          <Link
            href="/boutique/panier"
            className="grid size-11 place-items-center rounded-full text-ink/80 hover:bg-cream hover:text-bordeaux"
            aria-label={t("cart")}
          >
            <IconBag className="size-[22px]" />
          </Link>
          <Link
            href={session ? "/compte" : "/connexion"}
            className="flex min-h-11 items-center gap-2 rounded-full px-2.5 text-ink/80 hover:bg-cream hover:text-bordeaux"
          >
            <IconAccount className="size-[22px]" />
            <span className="hidden whitespace-nowrap text-[0.95rem] font-medium sm:inline xl:hidden 2xl:inline">
              {session ? (session.profile?.first_name ?? t("account")) : t("signIn")}
            </span>
          </Link>
          <div className="hidden lg:block xl:hidden 2xl:block">
            <LocaleSwitch />
          </div>
          <Link
            href={cta.href}
            className="ml-1 hidden min-h-11 items-center whitespace-nowrap rounded-full bg-bordeaux px-4 text-[0.95rem] font-semibold text-cream transition-colors hover:bg-ink md:flex xl:hidden 2xl:flex"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
