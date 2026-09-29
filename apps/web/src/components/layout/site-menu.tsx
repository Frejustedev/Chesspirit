"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";
import { IconArrow, IconClose, IconMenu } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "./locale-switch";

type Item = { href: string; label: string };
type Section = Item & { key: string; items: Item[] };

const FILES = "abcdefgh";

/**
 * Menu complet du site : les huit rubriques et toutes leurs pages d'un seul coup d'œil,
 * le prochain tournoi en tête, puis les pages d'information et l'espace personnel.
 */
export function SiteMenu({
  sections,
  info,
  mine,
  next,
  labels,
}: {
  sections: Section[];
  info: Item[];
  mine: Item[];
  next: { href: string; registerHref: string | null; name: string; date: string } | null;
  labels: {
    button: string;
    open: string;
    close: string;
    title: string;
    next: string;
    register: string;
    see: string;
    about: string;
    mySpace: string;
    language: string;
  };
}) {
  const pathname = usePathname();
  // Le menu se ferme de lui-même quand la page change : il n'est ouvert que pour la page où on l'a ouvert.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        className="-ml-2 flex min-h-11 items-center gap-2 rounded-full px-2.5 text-fg/85 hover:bg-surface hover:text-accent"
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls="menu-site"
      >
        <IconMenu className="size-6" />
        <span className="hidden text-[0.95rem] font-semibold md:inline">{labels.button}</span>
      </button>
      {open
        ? createPortal(
            <div
              id="menu-site"
              role="dialog"
              aria-modal="true"
              aria-label={labels.title}
              className="fixed inset-0 z-50 flex animate-[rise_300ms_var(--ease-out-soft)_both] flex-col bg-paper"
            >
              <div className="border-b border-line">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:h-[72px] lg:px-6">
                  <Link href="/" className="text-[1.65rem] leading-none lg:text-[1.8rem]">
                    <Logo />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenOn(null)}
                    className="flex min-h-11 items-center gap-2 rounded-full px-3 hover:bg-surface hover:text-accent"
                    aria-label={labels.close}
                  >
                    <span className="hidden text-[0.95rem] font-semibold sm:inline">
                      {labels.close}
                    </span>
                    <IconClose className="size-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 lg:px-6 lg:pt-10">
                  {next ? (
                    <div className="flex flex-col gap-4 rounded-lg border border-gold/40 bg-gold-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div>
                        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                          {labels.next}
                        </p>
                        <p className="mt-1 font-display text-2xl font-semibold leading-tight">
                          {next.name}
                        </p>
                        <p className="mt-0.5 text-stone first-letter:uppercase">{next.date}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {next.registerHref ? (
                          <Link
                            href={next.registerHref}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bordeaux px-5 font-semibold text-cream hover:bg-bordeaux-bright"
                          >
                            {labels.register} <IconArrow className="size-5" />
                          </Link>
                        ) : null}
                        <Link
                          href={next.href}
                          className="font-semibold text-accent hover:underline"
                        >
                          {labels.see}
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  <nav aria-label={labels.title} className="mt-8">
                    <ul className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
                      {sections.map((s, i) => (
                        <li key={s.key}>
                          <Link
                            href={s.href}
                            className="group flex items-center gap-3 border-b border-line pb-2"
                          >
                            <span
                              aria-hidden
                              className={`grid size-7 shrink-0 place-items-center rounded-sm font-sans text-sm font-bold ${
                                i % 2 === 0
                                  ? "bg-square-light text-square-dark"
                                  : "bg-square-dark text-square-light"
                              }`}
                            >
                              {FILES[i]}
                            </span>
                            <span className="font-display text-2xl font-semibold group-hover:text-accent">
                              {s.label}
                            </span>
                          </Link>
                          <ul className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-1">
                            {s.items.map((it) => (
                              <li key={it.href}>
                                <Link
                                  href={it.href}
                                  aria-current={it.href === pathname ? "page" : undefined}
                                  className="flex min-h-10 items-center text-[0.98rem] leading-snug text-fg/85 hover:text-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent"
                                >
                                  {it.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </nav>

                  <div className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
                    <MenuGroup title={labels.about} items={info} />
                    <MenuGroup title={labels.mySpace} items={mine} />
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-stone">
                        {labels.language}
                      </p>
                      <div className="mt-3">
                        <LocaleSwitch />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuGroup({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-stone">
        {title}
      </p>
      <ul className="mt-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="flex min-h-10 items-center text-[0.98rem] text-fg/85 hover:text-accent"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
