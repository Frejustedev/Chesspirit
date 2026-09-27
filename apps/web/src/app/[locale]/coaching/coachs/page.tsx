import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PieceSvg } from "@/components/icons/pieces";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coaching");
  return { title: t("coachesTitle") };
}

export default async function CoachesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coaching");
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_coaches")
    .select("*")
    .order("is_chesspirit", { ascending: false })
    .order("display_name");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("coachesTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("coachesIntro")}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/coaching/coachs/${c.slug}`}
              className="group flex h-full gap-4 rounded-lg border border-line p-4 hover:border-bordeaux"
            >
              <PieceSvg
                kind={(["k", "q", "r", "b", "n"] as const)[i % 5]!}
                color={i % 2 ? "b" : "w"}
                className="size-14 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-display text-xl font-semibold group-hover:text-bordeaux">
                  {c.titles?.length ? (
                    <span className="mr-1 text-base text-bordeaux">{c.titles.join(" ")}</span>
                  ) : null}
                  {c.display_name} {c.is_demo ? <DemoBadge /> : null}
                </span>
                <span className="block text-sm text-stone">{tr(c.headline, locale)}</span>
                <span className="mt-2 block text-sm">
                  {(c.languages ?? []).map((l) => t(`lang.${l}`)).join(" · ")} · {c.city ?? ""}
                </span>
                {c.price_from != null ? (
                  <span className="mt-1 block text-sm font-semibold">
                    {t("from", { price: formatXof(c.price_from, locale) })}
                  </span>
                ) : null}
                {c.is_chesspirit ? (
                  <span className="mt-2 inline-block rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold">
                    {t("teamCoach")}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!data?.length ? <p className="mt-8 text-stone">{t("noCoaches")}</p> : null}
    </div>
  );
}
