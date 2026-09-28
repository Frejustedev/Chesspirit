import "server-only";
import { createClient } from "@/lib/supabase/server";

export const FIDE_CADENCES = ["standard", "rapid", "blitz"] as const;
export type FideCadence = (typeof FIDE_CADENCES)[number];

export type FideRow = {
  rank: number;
  id: string;
  displayName: string;
  fideId: string;
  titles: string[];
  club: string | null;
  isDemo: boolean;
  standard: number | null;
  rapid: number | null;
  blitz: number | null;
};

/**
 * Classement Elo FIDE officiel : profils publics ayant un identifiant FIDE, dernière liste importée,
 * triés par la cadence choisie ; les joueurs sans Elo dans cette cadence ne sont pas classés.
 */
export async function getFideRanking(
  cadence: FideCadence,
  limit = 500,
): Promise<{ rows: FideRow[]; period: string | null }> {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name, fide_id, club_name, titles, is_demo")
    .not("fide_id", "is", null);
  const ids = (profiles ?? []).map((p) => p.fide_id!);
  if (!ids.length) return { rows: [], period: null };
  const { data: fide } = await supabase
    .from("fide_ratings")
    .select("fide_id, period, title, standard, rapid, blitz")
    .in("fide_id", ids)
    .order("period", { ascending: false });
  const latest = new Map<string, NonNullable<typeof fide>[number]>();
  for (const f of fide ?? []) if (!latest.has(f.fide_id)) latest.set(f.fide_id, f);
  const rows = (profiles ?? [])
    .map((p) => ({ p, f: latest.get(p.fide_id!) }))
    .filter(({ f }) => f?.[cadence] != null)
    .sort((a, b) => b.f![cadence]! - a.f![cadence]!)
    .slice(0, limit)
    .map(({ p, f }, i) => ({
      rank: i + 1,
      id: p.id!,
      displayName: p.display_name ?? "",
      fideId: p.fide_id!,
      titles: f!.title ? [f!.title] : (p.titles ?? []),
      club: p.club_name,
      isDemo: !!p.is_demo,
      standard: f!.standard,
      rapid: f!.rapid,
      blitz: f!.blitz,
    }));
  const period =
    [...latest.values()]
      .map((f) => f.period)
      .sort()
      .at(-1) ?? null;
  return { rows, period };
}
