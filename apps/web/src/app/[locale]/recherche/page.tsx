import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV, SECONDARY_NAV } from "@/lib/nav";
import { cleanQuery } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IconSearch } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("searchPage");
  return { title: t("title"), robots: { index: false } };
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Recherche sur tout le site : pages, tournois, joueurs, clubs et structures. */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("searchPage");
  const tn = await getTranslations("nav");
  const needle = cleanQuery(sp.q);

  const pages = needle
    ? [
        ...NAV.flatMap((s) => [
          { href: s.href, label: tn(`sections.${s.key}`), section: "" },
          ...s.items.map((i) => ({
            href: i.href,
            label: tn(`items.${i.key}`),
            section: tn(`sections.${s.key}`),
          })),
        ]),
        ...SECONDARY_NAV.map((i) => ({ href: i.href, label: tn(`items.${i.key}`), section: "" })),
      ]
        .filter((p, i, all) => all.findIndex((x) => x.href === p.href && x.label === p.label) === i)
        .filter((p) => fold(`${p.label} ${p.section}`).includes(needle))
        .slice(0, 12)
    : [];

  let tournaments: {
    slug: string;
    name: string;
    starts_at: string;
    city: string | null;
    is_demo: boolean;
  }[] = [];
  let players: {
    id: string | null;
    display_name: string | null;
    club_name: string | null;
    is_demo: boolean | null;
  }[] = [];
  let orgs: { slug: string; name: string; city: string | null; is_demo: boolean }[] = [];
  if (needle.length >= 2) {
    const supabase = await createClient();
    const [a, b, c] = await Promise.all([
      supabase
        .from("tournaments")
        .select("slug, name, starts_at, city, is_demo")
        .neq("status", "draft")
        .ilike("search_text", `%${needle}%`)
        .order("starts_at", { ascending: false })
        .limit(10),
      supabase
        .from("public_profiles")
        .select("id, display_name, club_name, is_demo")
        .ilike("search_text", `%${needle}%`)
        .order("last_name")
        .limit(12),
      supabase
        .from("organizations")
        .select("slug, name, city, is_demo")
        .eq("is_public", true)
        .or(`name.ilike.%${needle}%,city.ilike.%${needle}%`)
        .order("name")
        .limit(10),
    ]);
    tournaments = a.data ?? [];
    players = b.data ?? [];
    orgs = c.data ?? [];
  }
  const total = pages.length + tournaments.length + players.length + orgs.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <form action="/recherche" role="search" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          {t("label")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={sp.q ?? ""}
          placeholder={t("placeholder")}
          autoFocus
          className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-field px-5 text-[1.05rem]"
        />
        <button
          type="submit"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-5 font-semibold text-onaccent hover:bg-gold-deep"
        >
          <IconSearch className="size-5" />
          <span className="hidden sm:inline">{t("submit")}</span>
        </button>
      </form>

      {needle ? (
        <p className="mt-4 text-stone">{t("count", { n: total, q: sp.q ?? "" })}</p>
      ) : (
        <p className="mt-4 text-stone">{t("hint")}</p>
      )}

      {pages.length ? (
        <Group title={t("pages")}>
          {pages.map((p) => (
            <li key={`${p.href}-${p.label}`}>
              <Link
                href={p.href}
                className="flex min-h-11 items-baseline gap-2 py-2 hover:text-accent"
              >
                <span className="font-semibold">{p.label}</span>
                {p.section ? <span className="text-sm text-stone">{p.section}</span> : null}
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
      {tournaments.length ? (
        <Group title={t("tournaments")}>
          {tournaments.map((x) => (
            <li key={x.slug}>
              <Link
                href={`/competitions/${x.slug}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-2 py-2 hover:text-accent"
              >
                <span className="font-semibold">{x.name}</span>
                {x.is_demo ? <DemoBadge /> : null}
                <span className="text-sm text-stone">
                  {[
                    formatDate(x.starts_at, locale, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                    x.city,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
      {players.length ? (
        <Group title={t("players")}>
          {players.map((x) => (
            <li key={x.id}>
              <Link
                href={`/joueurs/${x.id}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-2 py-2 hover:text-accent"
              >
                <span className="font-semibold">{x.display_name}</span>
                {x.is_demo ? <DemoBadge /> : null}
                {x.club_name ? <span className="text-sm text-stone">{x.club_name}</span> : null}
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
      {orgs.length ? (
        <Group title={t("structures")}>
          {orgs.map((x) => (
            <li key={x.slug}>
              <Link
                href={`/annuaire/structures/${x.slug}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-2 py-2 hover:text-accent"
              >
                <span className="font-semibold">{x.name}</span>
                {x.is_demo ? <DemoBadge /> : null}
                {x.city ? <span className="text-sm text-stone">{x.city}</span> : null}
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        {title}
      </h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">{children}</ul>
    </section>
  );
}
