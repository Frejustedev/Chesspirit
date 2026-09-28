/** Adresses publiques fournies à la compilation (EXPO_PUBLIC_*). Aucun secret dans l'application. */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? "https://chesspirit.com").replace(/\/$/, ""),
};

/** Texte bilingue stocké en JSON ({ fr, en }) : français par défaut. */
export function tr(value: unknown, locale: "fr" | "en" = "fr"): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return String(v[locale] ?? v.fr ?? "");
  }
  return "";
}
