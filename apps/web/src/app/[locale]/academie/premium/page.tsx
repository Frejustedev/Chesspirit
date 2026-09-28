import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { hasPremium } from "@/lib/membership";
import { tr } from "@/lib/i18n-json";
import { Tbc } from "@/components/ui/tbc";
import { AcademyNav } from "@/components/content/academy-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.premium");
  return { title: t("title"), description: t("intro") };
}

export default async function PremiumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community.premium");
  const tc = await getTranslations("coaching");
  const supabase = await createClient();
  const session = await getSession();
  const [{ data: plan }, { data: lessons }, { data: resources }, premium] = await Promise.all([
    supabase.from("membership_plans").select("*").eq("code", "premium").maybeSingle(),
    supabase
      .from("lesson_catalog")
      .select("slug, title, summary, level")
      .eq("is_premium", true)
      .order("position"),
    supabase.from("resource_catalog").select("id, title").eq("is_premium", true),
    hasPremium(session?.profile?.id ?? null),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie/premium" />
      </div>
      <div className="mt-8 rounded-lg bg-ink p-6 text-cream">
        {premium ? (
          <p className="font-display text-2xl font-semibold">{t("youArePremium")}</p>
        ) : (
          <>
            <p className="font-display text-2xl font-semibold">
              {plan?.price_xof == null ? (
                <>
                  {t("priceLabel")} <Tbc />
                </>
              ) : (
                t("price", {
                  price: formatXof(plan.price_xof, locale),
                  months: plan.duration_months ?? 12,
                })
              )}
            </p>
            <Link
              href="/communaute/adhesion"
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold hover:text-cream"
            >
              {t("cta")} →
            </Link>
          </>
        )}
      </div>
      <h2 className="mt-10 font-display text-2xl font-semibold">{t("lessons")}</h2>
      {lessons?.length ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/academie/lecons/${l.slug}`}
                className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-bordeaux"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
                  {tc(`level.${l.level}`)}
                </span>
                <span className="mt-1 font-display text-xl font-semibold">
                  {tr(l.title, locale)}
                </span>
                <span className="mt-1 text-sm text-stone">{tr(l.summary, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-stone">{t("noLessons")}</p>
      )}
      {resources?.length ? (
        <>
          <h2 className="mt-10 font-display text-2xl font-semibold">{t("resources")}</h2>
          <ul className="mt-3 list-disc pl-5">
            {resources.map((r) => (
              <li key={r.id}>{tr(r.title, locale)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
