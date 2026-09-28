import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Requête invalide", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("pgn, white_name, black_name")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Introuvable", { status: 404 });
  const name = `${data.white_name}-${data.black_name}`.normalize("NFD").replace(/[^\w-]+/g, "_");
  return new Response(data.pgn, {
    headers: {
      "content-type": "application/x-chess-pgn; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.pgn"`,
    },
  });
}
