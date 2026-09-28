import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { cityPoint } from "@/lib/geo";
import { DirectoryNav } from "@/components/directory/directory-nav";
import { WhereToPlayMap, type MapPoint } from "@/components/directory/where-to-play-map";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("mapTitle"), description: t("mapIntro") };
}

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { focus } = await searchParams;
  const t = await getTranslations("directory");
  const supabase = await createClient();
  const [{ data: orgs }, { data: tournaments }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, slug, name, type, city, lat, lng")
      .eq("is_public", true)
      .limit(500),
    supabase
      .from("tournaments")
      .select("id, slug, name, city, lat, lng, starts_at")
      .in("status", ["published", "registration_open", "registration_closed", "ongoing"])
      .eq("is_online", false)
      .limit(200),
  ]);
  const points: MapPoint[] = [];
  const unplaced: { name: string; href: string }[] = [];
  for (const o of orgs ?? []) {
    const at = o.lat && o.lng ? ([o.lat, o.lng] as [number, number]) : cityPoint(o.city);
    if (!at) {
      unplaced.push({ name: o.name, href: `/annuaire/structures/${o.slug}` });
      continue;
    }
    points.push({
      id: o.slug,
      lat: at[0],
      lng: at[1],
      title: o.name,
      subtitle: [t(`orgType.${o.type}`), o.city].filter(Boolean).join(" · "),
      href: `/${locale === "fr" ? "" : "en/"}annuaire/structures/${o.slug}`.replace("//", "/"),
      kind: "structure",
    });
  }
  for (const x of tournaments ?? []) {
    const at = x.lat && x.lng ? ([x.lat, x.lng] as [number, number]) : cityPoint(x.city);
    if (!at) continue;
    points.push({
      id: x.slug,
      lat: at[0],
      lng: at[1],
      title: x.name,
      subtitle: `${t("tournament")} · ${formatDate(x.starts_at, locale)}`,
      href: `/${locale === "fr" ? "" : "en/"}competitions/${x.slug}`.replace("//", "/"),
      kind: "tournament",
    });
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("mapTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("mapIntro")}</p>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/carte" />
      </div>
      <div className="mt-6">
        <WhereToPlayMap points={points} focus={focus} label={t("mapTitle")} />
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-sm text-stone">
        <span>
          <span aria-hidden className="mr-1 inline-block size-3 rounded-full bg-bordeaux" />{" "}
          {t("legendStructure")}
        </span>
        <span>
          <span aria-hidden className="mr-1 inline-block size-3 rounded-full bg-gold" />{" "}
          {t("legendTournament")}
        </span>
        <span>{t("mapApprox")}</span>
      </p>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("mapList")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {points.map((p) => (
            <li key={`${p.kind}-${p.id}`}>
              <a href={p.href} className="font-semibold hover:text-bordeaux">
                {p.title}
              </a>{" "}
              <span className="text-sm text-stone">{p.subtitle}</span>
            </li>
          ))}
          {unplaced.map((u) => (
            <li key={u.href}>
              <Link href={u.href} className="font-semibold hover:text-bordeaux">
                {u.name}
              </Link>{" "}
              <span className="text-sm text-stone">{t("noLocation")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
