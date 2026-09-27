"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { IconClose, IconMenu, IconChevronDown } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "./locale-switch";

type Section = { key: string; href: string; label: string; items: { href: string; label: string }[] };

export function MobileMenu({
  sections,
  labels,
  ctaHref,
}: {
  sections: Section[];
  labels: { open: string; close: string; account: string; cta: string };
  ctaHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-cream"
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls="menu-mobile"
      >
        <IconMenu className="size-6" />
      </button>
      {open ? (
        <div id="menu-mobile" role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo className="text-[1.65rem]" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-11 place-items-center rounded-full hover:bg-cream"
              aria-label={labels.close}
            >
              <IconClose className="size-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-2">
            <ul>
              {sections.map((s, idx) => (
                <li key={s.key} className="border-b border-line/70">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between text-left"
                    aria-expanded={expanded === s.key}
                    onClick={() => setExpanded(expanded === s.key ? null : s.key)}
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="tabular w-6 font-sans text-xs text-stone">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="font-display text-xl">{s.label}</span>
                    </span>
                    <IconChevronDown
                      className={`size-5 text-stone transition-transform ${expanded === s.key ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expanded === s.key ? (
                    <ul className="pb-3 pl-9">
                      {s.items.map((i) => (
                        <li key={i.href}>
                          <Link href={i.href} className="flex min-h-11 items-center text-[1.02rem] text-ink/85">
                            {i.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center justify-between gap-3 border-t border-line p-4">
            <LocaleSwitch />
            <Link
              href={ctaHref}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-bordeaux px-4 font-semibold text-cream"
            >
              {labels.cta}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
