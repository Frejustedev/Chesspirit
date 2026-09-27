import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myGames } from "@/lib/data/me";

/** Téléchargement de toutes ses parties (filtres de la page « Mes parties ») en un seul PGN. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.profile) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  const f = Object.fromEntries(req.nextUrl.searchParams);
  const games = await myGames(session, f, 5000);
  const supabase = await createClient();
  const ids = games.map((g) => g.id);
  const pgns: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("games")
      .select("id, pgn")
      .in("id", ids.slice(i, i + 200));
    const by = new Map((data ?? []).map((d) => [d.id, d.pgn]));
    for (const id of ids.slice(i, i + 200)) if (by.get(id)) pgns.push(by.get(id)!.trim());
  }
  return new Response(pgns.join("\n\n") + "\n", {
    headers: {
      "content-type": "application/x-chess-pgn; charset=utf-8",
      "content-disposition": `attachment; filename="chesspirit-mes-parties.pgn"`,
      "cache-control": "private, no-store",
    },
  });
}
