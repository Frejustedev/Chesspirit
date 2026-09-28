/** Garde l'origine d'une URL (« https://ref.supabase.co/rest/v1/ » collée depuis le tableau de bord → « https://ref.supabase.co »). */
function origin(raw: string | undefined, fallback: string) {
  try {
    return new URL((raw ?? "").trim() || fallback).origin;
  } catch {
    return fallback;
  }
}

/** Variables d'environnement publiques (valeurs par défaut = pile locale). */
export const env = {
  siteUrl: origin(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  supabaseUrl: origin(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://localhost:54321"),
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    // Clé « anon » de démonstration de la CLI Supabase (publique, locale uniquement).
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  // Le bouton Google suit le réglage de Supabase Auth ; « false » le masque malgré tout.
  googleAuthEnabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== "false",
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "",
  plausibleHost: process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_BANNER !== "false",
};
