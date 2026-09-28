import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
  const { data: resources } = await supabase.from("resources").select("*").order("created_at");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("nav.resources")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("resourcesIntro")}</p>
      <div className="mt-6">
        <AcademyNav current="/academie/ressources" />
      </div>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {(resources ?? []).map((r) => (
          <li key={r.id} className="py-4">
            <a
              href={r.url}
              {...(r.url.startsWith("https://")
                ? { rel: "noopener noreferrer", target: "_blank" }
                : {})}
              className="font-semibold hover:text-bordeaux"
            >
              {tr(r.title, locale)}
              {r.url.startsWith("https://") ? " ↗" : ""}
            </a>
            <p className="text-sm text-stone">
              {t(`resourceKind.${r.kind}`)} · {tm(`lang.${r.language}`)}
              {r.is_premium ? ` · ${t("premiumBadge")}` : ""}
            </p>
            {tr(r.description, locale) ? <p className="mt-1">{tr(r.description, locale)}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
