"use client";

import { Link, usePathname } from "@/i18n/navigation";

export function AdminNavLinks({ items, label }: { items: [string, string][]; label: string }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/admin"
      ? path === "/admin" || path.startsWith("/admin/tournois")
      : path.startsWith(href);
  return (
    <nav aria-label={label} className="border-b border-line bg-cream/60">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 lg:px-6">
        {items.map(([href, text]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[0.95rem] ${active(href) ? "border-bordeaux font-semibold text-bordeaux" : "border-transparent text-ink/80 hover:text-bordeaux"}`}
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
