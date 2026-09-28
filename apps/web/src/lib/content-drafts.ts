import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Brouillon d'article à la clôture d'un tournoi (podium, lien vers les résultats) :
 * l'équipe éditoriale le complète et le publie. Sans effet s'il existe déjà.
 */
export async function createResultsDraft(tournamentId: string) {
  const db = createAdminClient();
  const { data: t } = await db
    .from("tournaments")
    .select("id, slug, name, city, rounds_count, is_demo")
    .eq("id", tournamentId)
    .single();
  if (!t) return;
  const slug = `resultats-${t.slug}`.slice(0, 100);
  const { data: existing } = await db.from("articles").select("id").eq("slug", slug).maybeSingle();
  if (existing) return;
  const { data: podium } = await db
    .from("public_standings")
    .select("rank, display_name, points")
    .eq("tournament_id", t.id)
    .order("rank")
    .limit(3);
  const lines = (podium ?? []).map((p) => `- ${p.rank}. **${p.display_name}** — ${p.points} pts`);
  await db.from("articles").insert({
    slug,
    tournament_id: t.id,
    status: "draft",
    is_demo: t.is_demo,
    title: { fr: `${t.name} : les résultats`, en: `${t.name}: the results` },
    excerpt: {
      fr: `Le podium et le classement complet du tournoi${t.city ? ` de ${t.city}` : ""}.`,
      en: `The podium and full standings of the tournament${t.city ? ` in ${t.city}` : ""}.`,
    },
    body: {
      fr: `## Le podium\n\n${lines.join("\n") || "- (à compléter)"}\n\n## Le déroulement\n\n(À compléter par la rédaction.)`,
      en: `## The podium\n\n${lines.join("\n") || "- (to be completed)"}\n\n## How it went\n\n(To be completed by the editorial team.)`,
    },
    tags: ["résultats"],
  });
}
