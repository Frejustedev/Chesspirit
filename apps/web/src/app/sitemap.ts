import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { ALL_NAV_HREFS } from "@/lib/nav";
import type { Database } from "@/lib/supabase/types";

export const revalidate = 3600;

/**
 * Plan du site : pages publiques (français et anglais) et contenus publiés, hors données de démonstration.
 * Lecture avec la clé publique (règles d'accès de la base) : aucune clé secrète, et la compilation
 * n'échoue pas si la base est injoignable (le plan est alors régénéré à la revalidation suivante).
 */
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
  const pages = [entry("/"), ...[...ALL_NAV_HREFS].filter((h) => h !== "/").map((h) => entry(h))];
  try {
    const db = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
        db.from("lesson_catalog").select("slug").limit(1000),
      ]);
    return [
      ...pages,
      ...(tournaments ?? []).map((t) => entry(`/competitions/${t.slug}`, t.updated_at)),
      ...(articles ?? []).map((a) => entry(`/media/articles/${a.slug}`, a.updated_at)),
      ...(episodes ?? []).map((e) => entry(`/media/episodes/${e.slug}`, e.updated_at)),
      ...(lessons ?? []).flatMap((l) => (l.slug ? [entry(`/academie/lecons/${l.slug}`)] : [])),
    ];
  } catch {
    return pages;
  }
}
