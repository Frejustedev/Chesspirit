import "server-only";
import { env } from "@/lib/env";

export type AuthMethods = { phone: boolean; email: boolean; google: boolean };

/**
 * Méthodes de connexion réellement actives, lues dans les réglages publics de Supabase Auth.
 * Tant qu'aucun fournisseur SMS n'est branché, l'onglet téléphone disparaît ; le bouton Google n'apparaît
 * que si le fournisseur est activé (et que NEXT_PUBLIC_AUTH_GOOGLE_ENABLED ne vaut pas « false »).
 */
export async function getAuthMethods(): Promise<AuthMethods> {
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`auth_settings_${res.status}`);
    const { external = {} } = (await res.json()) as { external?: Record<string, unknown> };
    const email = external.email !== false;
    return {
      phone: external.phone === true || !email,
      email,
      google: external.google === true && env.googleAuthEnabled,
    };
  } catch {
    // Réglages illisibles : comportement historique (téléphone et e-mail proposés).
    return { phone: true, email: true, google: false };
  }
}
