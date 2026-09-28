import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { identityFromCode } from "@/lib/lichess";
import { createAdminClient } from "@/lib/supabase/admin";

/** Retour de Lichess : vérification de l'état, identité lue puis jeton révoqué, liaison enregistrée. */
export async function GET(req: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(`${env.siteUrl}/compte/profil?lichess=${status}#lichess`);
    res.cookies.delete({ name: "lichess_pkce", path: "/api/lichess" });
    return res;
  };
  const session = await getSession();
  if (!session?.profile) return back("error");
  let saved: { verifier?: string; state?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("lichess_pkce")?.value ?? "{}");
  } catch {
    return back("error");
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !saved.verifier || state !== saved.state) return back("error");
  try {
    const who = await identityFromCode(code, saved.verifier, `${env.siteUrl}/api/lichess/callback`);
    const { error } = await createAdminClient()
      .from("lichess_accounts")
      .upsert(
        { profile_id: session.profile.id, username: who.username, lichess_id: who.id },
        { onConflict: "profile_id" },
      );
    return back(error ? (error.code === "23505" ? "taken" : "error") : "ok");
  } catch {
    return back("error");
  }
}
