import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryNav } from "@/components/directory/directory-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("title"), description: t("intro") };
}

export default async function DirectoryHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("directory");
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [players, coaches, arbiters, structures, jobs] = (
    await Promise.all([
      supabase.from("public_profiles").select("id", head),
      supabase.from("public_coaches").select("id", head),
      supabase.from("public_arbiters").select("profile_id", head),
      supabase.from("organizations").select("id", head).eq("is_public", true),
      supabase.from("job_posts").select("id", head).eq("status", "published"),
    ])
  ).map((r) => r.count ?? 0);
  const cards = [
    ["/annuaire/joueurs", "players", players],
    ["/annuaire/entraineurs", "coaches", coaches],
    ["/annuaire/arbitres", "arbiters", arbiters],
    ["/annuaire/clubs", "structures", structures],
    ["/annuaire/emplois", "jobs", jobs],
  ] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <DirectoryNav current="/annuaire" />
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([href, key, n]) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col rounded-lg border border-line p-5 hover:border-accent"
            >
              <span className="tabular font-display text-4xl font-semibold">{n}</span>
              <span className="mt-1 font-semibold">{t(`nav.${key}`)}</span>
              <span className="mt-1 text-sm text-stone">{t(`cards.${key}`)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/annuaire/carte"
            className="flex h-full flex-col justify-between rounded-lg bg-ink p-5 text-cream hover:bg-bordeaux"
          >
            <span className="font-display text-2xl font-semibold">{t("mapTitle")}</span>
            <span className="mt-2 text-cream/80">{t("mapIntro")}</span>
          </Link>
        </li>
      </ul>
      <section className="mt-12 grid gap-6 rounded-lg border border-line p-6 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("proposeTitle")}</h2>
          <p className="mt-1 text-stone">{t("proposeIntro")}</p>
          <Link
            href="/annuaire/proposer"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent hover:underline"
          >
            {t("propose")} →
          </Link>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("claimTitle")}</h2>
          <p className="mt-1 text-stone">{t("claimText")}</p>
          <Link
            href="/annuaire/clubs"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent hover:underline"
          >
            {t("findMine")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
