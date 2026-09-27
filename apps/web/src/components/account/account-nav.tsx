import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IconLogout } from "@/components/icons";

export async function AccountNav({ current, isAdmin }: { current: string; isAdmin: boolean }) {
  const t = await getTranslations("account");
  const items = [
    { href: "/compte", key: "dashboard" },
    { href: "/compte/profil", key: "profile" },
    { href: "/compte/famille", key: "family" },
    { href: "/compte/donnees", key: "data" },
    ...(isAdmin ? [{ href: "/admin", key: "admin" }] : []),
  ];
  return (
    <nav aria-label={t("nav")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 border-b border-line lg:flex-col lg:border-0">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={current === i.href ? "page" : undefined}
              className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[0.98rem] lg:rounded lg:border-0 ${current === i.href ? "border-bordeaux font-semibold text-bordeaux lg:bg-cream" : "border-transparent text-ink/80 hover:text-bordeaux"}`}
            >
              {t(i.key)}
            </Link>
          </li>
        ))}
        <li>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-[0.98rem] text-stone hover:text-bordeaux"
            >
              <IconLogout className="size-4" /> {t("signOut")}
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}

export function AccountShell({
  nav,
  title,
  children,
}: {
  nav: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[13rem_1fr] lg:px-6 lg:py-12">
      <aside className="min-w-0">{nav}</aside>
      <div className="min-w-0">
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
