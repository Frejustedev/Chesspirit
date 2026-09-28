import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AcademyNav } from "@/components/content/academy-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academy");
  return { title: t("nav.resources") };
}

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("academy");
  const tm = await getTranslations("media");
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resource_catalog")
    .select("*")
    .order("created_at");
  // Liens premium : lisibles seulement avec l'adhésion premium (règles d'accès de la base).
  const { data: unlocked } = await supabase
    .from("resources")
    .select("id, url")
    .eq("is_premium", true);
  const urls = new Map((unlocked ?? []).map((u) => [u.id, u.url]));
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("nav.resources")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("resourcesIntro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie/ressources" />
      </div>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {(resources ?? [])
          .map((r) => ({ ...r, url: r.url ?? urls.get(r.id!) ?? null }))
          .map((r) => (
            <li key={r.id} className="py-4">
              {r.url ? (
                <a
                  href={r.url}
                  {...(r.url.startsWith("https://")
                    ? { rel: "noopener noreferrer", target: "_blank" }
                    : {})}
                  className="font-semibold hover:text-accent"
                >
                  {tr(r.title, locale)}
                  {r.url.startsWith("https://") ? " ↗" : ""}
                </a>
              ) : (
                <Link href="/academie/premium" className="font-semibold hover:text-accent">
                  {tr(r.title, locale)} · {t("premiumLockedShort")}
                </Link>
              )}
              <p className="text-sm text-stone">
                {t(`resourceKind.${r.kind}`)} · {tm(`lang.${r.language}`)}
                {r.is_premium ? ` · ${t("premiumBadge")}` : ""}
              </p>
              {tr(r.description, locale) ? (
                <p className="mt-1">{tr(r.description, locale)}</p>
              ) : null}
            </li>
          ))}
      </ul>
    </div>
  );
}
