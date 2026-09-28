import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { ALL_NAV_HREFS } from "@/lib/nav";

export const revalidate = 3600;

/** Plan du site : pages publiques (français et anglais) et contenus publiés, hors données de démonstration. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const entry = (path: string, lastModified?: string | null): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: lastModified ?? undefined,
    alternates: {
      languages: {
        fr: `${base}${path === "/" ? "" : path}`,
        en: `${base}/en${path === "/" ? "" : path}`,
      },
    },
  });
  const db = createAdminClient();
  const [{ data: tournaments }, { data: articles }, { data: episodes }, { data: lessons }] =
    await Promise.all([
      db
        .from("tournaments")
        .select("slug, updated_at")
        .neq("status", "draft")
        .eq("is_demo", false)
        .limit(1000),
      db.from("articles").select("slug, updated_at").eq("status", "published").limit(1000),
      db
        .from("media_episodes")
        .select("slug, updated_at")
        .eq("status", "published")
        .eq("is_demo", false)
        .limit(1000),
      db.from("lessons_library").select("slug, updated_at").eq("status", "published").limit(1000),
    ]);
  return [
    entry("/"),
    ...[...ALL_NAV_HREFS].filter((h) => h !== "/").map((h) => entry(h)),
    ...(tournaments ?? []).map((t) => entry(`/competitions/${t.slug}`, t.updated_at)),
    ...(articles ?? []).map((a) => entry(`/media/articles/${a.slug}`, a.updated_at)),
    ...(episodes ?? []).map((e) => entry(`/media/episodes/${e.slug}`, e.updated_at)),
    ...(lessons ?? []).map((l) => entry(`/academie/lecons/${l.slug}`, l.updated_at)),
  ];
}
