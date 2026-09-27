import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { listOffers } from "@/lib/coaching/data";
import { OfferCard } from "@/components/coaching/offer-card";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PieceSvg } from "@/components/icons/pieces";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("public_coaches").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  return c ? { title: c.display_name ?? "" } : {};
}

export default async function CoachPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const c = await load(slug);
  if (!c) notFound();
  const t = await getTranslations("coaching");
  const supabase = await createClient();
  const [offers, { data: reviews }] = await Promise.all([
    listOffers({}, c.id!),
    supabase
      .from("coach_reviews")
      .select("stars, comment, created_at")
      .eq("coach_id", c.id!)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex items-start gap-5">
        <PieceSvg kind="k" color="w" className="size-20 shrink-0" />
        <div>
          <h1 className="font-display text-4xl font-semibold">
            {c.titles?.length ? (
              <span className="mr-2 text-2xl text-bordeaux">{c.titles.join(" ")}</span>
            ) : null}
            {c.display_name} {c.is_demo ? <DemoBadge /> : null}
          </h1>
          <p className="mt-1 text-lg text-stone">{tr(c.headline, locale)}</p>
          <p className="mt-2 text-sm">
            {(c.languages ?? []).map((l) => t(`lang.${l}`)).join(" · ")} ·{" "}
            {(c.modalities ?? []).map((m) => t(`modality.${m}`)).join(" · ")}
            {c.city ? ` · ${c.city}` : ""}
          </p>
          {c.rating_avg ? (
            <p className="mt-1 text-sm font-semibold">
              {t("rating", { avg: c.rating_avg, n: c.reviews_count ?? 0 })}
            </p>
          ) : null}
        </div>
      </div>
      {tr(c.bio, locale) ? (
        <p className="prose-cs mt-8 max-w-3xl whitespace-pre-line">{tr(c.bio, locale)}</p>
      ) : null}
      {c.specialties?.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {c.specialties.map((s) => (
            <li key={s} className="rounded-full border border-line px-3 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
      ) : null}
      <h2 className="mt-10 font-display text-2xl font-semibold">{t("offers")}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {offers.map((o) => (
          <OfferCard key={o.id} o={o} locale={locale} />
        ))}
      </ul>
      {reviews?.length ? (
        <>
          <h2 className="mt-10 font-display text-2xl font-semibold">{t("reviews")}</h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-md border border-line p-3">
                <p className="text-gold-deep" aria-label={t("stars", { n: r.stars })}>
                  {"★".repeat(r.stars)}
                  {"☆".repeat(5 - r.stars)}
                </p>
                {r.comment ? <p className="mt-1">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
