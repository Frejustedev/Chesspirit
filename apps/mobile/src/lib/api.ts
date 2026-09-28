import { config } from "./config";
import { supabase } from "./supabase";

export type RegisterResponse =
  { ok: true; paymentUrl?: string; ticketUrl?: string } | { ok: false; error: string };

/** Inscription par l'API du site (le paiement est démarré côté serveur, jamais dans l'application). */
export async function registerForTournament(input: {
  tournamentId: string;
  playerId: string;
  paymentMethod: "online" | "on_site" | "free";
}): Promise<RegisterResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "auth_required" };
  try {
    const r = await fetch(`${config.siteUrl}/api/mobile/register`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...input, answers: {}, acceptRules: true }),
    });
    return (await r.json()) as RegisterResponse;
  } catch {
    return { ok: false, error: "network" };
  }
}

const MESSAGES: Record<string, string> = {
  auth_required: "Connectez-vous pour vous inscrire.",
  invalid_answers:
    "Ce tournoi demande des informations complémentaires : inscrivez-vous sur le site.",
  already_registered: "Ce joueur est déjà inscrit.",
  registration_closed: "Les inscriptions sont fermées.",
  payment_unavailable: "Le paiement en ligne est momentanément indisponible.",
  network: "Pas de connexion au serveur. Réessayez.",
};
export const registerError = (code: string) =>
  MESSAGES[Object.keys(MESSAGES).find((k) => code.includes(k)) ?? ""] ??
  "L'inscription n'a pas pu aboutir.";
