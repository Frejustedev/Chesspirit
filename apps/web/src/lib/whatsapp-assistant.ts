import "server-only";
import { formatDate } from "@chesspirit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { detectIntent, type Intent } from "@/lib/whatsapp-intent";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Réponse de l'assistant : informations publiques seulement (calendrier, classement public,
 * cotes des profils publics). Aucune donnée personnelle n'est communiquée.
 */
export async function assistantReply(
  db: Db,
  text: string,
  fromPhone: string,
): Promise<{ intent: Intent; reply: string }> {
  const intent = detectIntent(text);
  const site = env.siteUrl.replace(/\/$/, "");
  if (intent.kind === "next_tournament" || intent.kind === "registration") {
    const { data: next } = await db
      .from("tournaments")
      .select("name, slug, starts_at, city, status, is_demo")
      .in("status", ["published", "registration_open"])
      .eq("is_demo", false)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(3);
    if (!next?.length)
      return {
        intent,
        reply: `Aucun tournoi annoncé pour l'instant. Calendrier : ${site}/competitions`,
      };
    const lines = next.map(
      (t) =>
        `• ${t.name} — ${formatDate(t.starts_at)}${t.city ? `, ${t.city}` : ""} : ${site}/competitions/${t.slug}`,
    );
    const head =
      intent.kind === "registration"
        ? "Inscriptions en ligne (paiement Mobile Money) :"
        : "Prochains tournois :";
    return { intent, reply: `${head}\n${lines.join("\n")}` };
  }
  if (intent.kind === "ranking") {
    const { data: top } = await db
      .from("public_ratings")
      .select("display_name, rating, rank")
      .eq("type", "rapid")
      .eq("is_demo", false)
      .order("rank")
      .limit(5);
    if (!top?.length)
      return {
        intent,
        reply: `Le classement sera publié après les premiers tournois homologués : ${site}/classements`,
      };
    return {
      intent,
      reply: `Top 5 cote Chesspirit (rapide) :\n${top.map((r) => `${r.rank}. ${r.display_name} — ${r.rating}`).join("\n")}\nTout le classement : ${site}/classements`,
    };
  }
  if (intent.kind === "rating") {
    const q = intent.name.replace(/[^\p{L}\p{N} '-]/gu, "").slice(0, 40);
    const { data: found } = await db
      .from("public_ratings")
      .select("display_name, rating, type, profile_id")
      .ilike("display_name", `%${q}%`)
      .limit(6);
    if (!found?.length)
      return {
        intent,
        reply: `Aucun joueur public trouvé pour « ${q} ». Recherche : ${site}/annuaire/joueurs`,
      };
    return {
      intent,
      reply: found
        .map((r) => `${r.display_name} — ${r.type} ${r.rating} : ${site}/joueurs/${r.profile_id}`)
        .join("\n"),
    };
  }
  if (intent.kind === "coaching")
    return {
      intent,
      reply: `Cours individuels et collectifs, test de niveau gratuit : ${site}/coaching`,
    };
  if (intent.kind === "human")
    return {
      intent,
      reply: `Un membre de l'équipe vous répondra. Vous pouvez aussi écrire via ${site}/contact`,
    };
  if (intent.kind === "stop") {
    // Désinscription des notifications WhatsApp pour les profils liés à ce numéro.
    const { data: profiles } = await db
      .from("profiles")
      .select("id, notification_prefs")
      .eq("phone", fromPhone);
    for (const p of profiles ?? [])
      await db
        .from("profiles")
        .update({ notification_prefs: { ...(p.notification_prefs as object), whatsapp: false } })
        .eq("id", p.id);
    return {
      intent,
      reply: "C'est noté : vous ne recevrez plus de notifications Chesspirit sur WhatsApp.",
    };
  }
  return {
    intent,
    reply:
      "Bonjour, ici l'assistant Chesspirit. Écrivez par exemple :\n• « prochain tournoi »\n• « inscription »\n• « classement »\n• « cote » suivi d'un nom\n• « cours »\n• « humain » pour parler à l'équipe\n• « stop » pour ne plus recevoir de messages",
  };
}
