import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { CommunityHeader, CommunityNav } from "@/components/community/community-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.pvm");
  return { title: t("title"), description: t("intro") };
}

export default async function PvmList({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.pvm");
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("pvm_games")
    .select("slug, title, master_name, status, result, moves, is_demo, public_color")
    .neq("status", "draft")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <CommunityHeader title={t("title")} intro={t("intro")}>
        <CommunityNav current="/communaute/public-contre-le-maitre" />
      </CommunityHeader>
      {games?.length ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {games.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/communaute/public-contre-le-maitre/${g.slug}`}
                className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-5 hover:border-accent"
              >
                <span className="font-display text-2xl font-semibold">{tr(g.title, locale)}</span>
                <span className="mt-1 text-stone">
                  {t("master", { name: g.master_name })} · {t("moves", { n: g.moves.length })}
                </span>
                <span className="mt-2 text-sm font-semibold">
                  {g.status === "finished"
                    ? t("finished", { result: g.result ?? "—" })
                    : t("inProgress")}
                  {g.is_demo ? ` · ${t("demo")}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-stone">{t("none")}</p>
      )}
    </div>
  );
}
