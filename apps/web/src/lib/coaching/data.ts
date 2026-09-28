import "server-only";
import { createClient } from "@/lib/supabase/server";

export const LEVELS = ["discovery", "beginner", "intermediate", "advanced", "competition"] as const;
export const LANGS = ["fr", "en", "fon"] as const;
export const MODALITIES = ["in_person", "online"] as const;
export const FORMATS = ["individual", "group"] as const;
export type OfferFilters = { langue?: string; modalite?: string; niveau?: string; format?: string };

export async function listOffers(f: OfferFilters, coachId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("offers")
    .select(
      "id, title, description, language, modality, level, format, duration_min, price_xof, capacity, coach_id",
    )
    .eq("is_active", true)
    .order("price_xof");
  if (f.langue && (LANGS as readonly string[]).includes(f.langue)) q = q.eq("language", f.langue);
  if (f.modalite && (MODALITIES as readonly string[]).includes(f.modalite))
    q = q.eq("modality", f.modalite);
  if (f.niveau && (LEVELS as readonly string[]).includes(f.niveau)) q = q.eq("level", f.niveau);
  if (f.format && (FORMATS as readonly string[]).includes(f.format)) q = q.eq("format", f.format);
  if (coachId) q = q.eq("coach_id", coachId);
  const { data: offers } = await q.limit(200);
  const ids = [...new Set((offers ?? []).map((o) => o.coach_id))];
  const { data: coaches } = ids.length
    ? await supabase
        .from("public_coaches")
        .select("id, slug, display_name, is_demo, rating_avg")
        .in("id", ids)
    : { data: [] };
  const byId = new Map((coaches ?? []).map((c) => [c.id!, c]));
  return (offers ?? [])
    .map((o) => ({ ...o, coach: byId.get(o.coach_id) ?? null }))
    .filter((o) => o.coach);
}
