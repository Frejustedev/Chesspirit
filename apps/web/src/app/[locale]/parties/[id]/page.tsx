import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameWithNotes } from "@/components/chess/game-with-notes";
import { ShareButton } from "@/components/ui/share-button";
import { getSession } from "@/lib/auth";
import { IconDownload } from "@/components/icons";

type Props = { params: Promise<{ locale: string; id: string }> };

async function getGame(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("*, tournaments(name, slug, is_demo)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await getGame((await params).id);
  return g ? { title: `${g.white_name} – ${g.black_name}` } : {};
}

export default async function GamePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const g = await getGame(id);
  if (!g) notFound();
  const t = await getTranslations("viewer");
  const session = await getSession();
  const mine =
    session?.profile && (g.white_id === session.profile.id || g.black_id === session.profile.id)
      ? session.profile.id
      : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      {g.tournaments ? (
        <nav className="text-sm text-stone">
          <Link
            href={`/competitions/${g.tournaments.slug}/resultats`}
            className="hover:text-accent"
          >
            {g.tournaments.name}
          </Link>
          {g.round_number ? ` · ${t("round", { n: g.round_number })}` : ""}
        </nav>
      ) : null}
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
        {g.white_name} <span className="text-accent">{g.result.replace(/1\/2/g, "½")}</span>{" "}
        {g.black_name}
      </h1>
      <p className="mt-1 text-stone">
        {[g.played_on ? formatDate(g.played_on, locale) : null, g.eco, g.opening]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-6">
        <GameWithNotes gameId={g.id} pgn={g.pgn} profileId={mine} />
      </div>
      <a
        href={`/api/games/${g.id}/pgn`}
        className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline"
      >
        <IconDownload className="size-5" /> {t("download")}
      </a>
      <span className="ml-6">
        <ShareButton title={`${g.white_name} – ${g.black_name}`} />
      </span>
    </div>
  );
}
