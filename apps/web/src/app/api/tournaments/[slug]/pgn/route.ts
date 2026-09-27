import { createClient } from "@/lib/supabase/server";

/** Téléchargement de toutes les parties publiques d'un tournoi en PGN. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tournaments").select("id, slug").eq("slug", slug).maybeSingle();
  if (!t) return new Response("Introuvable", { status: 404 });
  const { data: games } = await supabase
    .from("games")
    .select("pgn")
    .eq("tournament_id", t.id)
    .order("round_number")
    .order("board");
  const body = (games ?? []).map((g) => g.pgn.trim()).join("\n\n") + "\n";
  return new Response(body, {
    headers: {
      "content-type": "application/x-chess-pgn; charset=utf-8",
      "content-disposition": `attachment; filename="${t.slug}.pgn"`,
    },
  });
}
