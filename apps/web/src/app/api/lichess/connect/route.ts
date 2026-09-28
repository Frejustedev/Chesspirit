import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { authorizeUrl, lichessFake, pkcePair } from "@/lib/lichess";

/** Début de la liaison Lichess (OAuth avec PKCE) ; le vérificateur reste dans un cookie httpOnly. */
export async function GET() {
  const session = await getSession();
  if (!session?.profile)
    return NextResponse.redirect(
      `${env.siteUrl}/connexion?next=${encodeURIComponent("/compte/profil")}`,
    );
  if (lichessFake())
    return NextResponse.redirect(`${env.siteUrl}/compte/profil?lichess=fake#lichess`);
  const { verifier, challenge, state } = pkcePair();
  const res = NextResponse.redirect(
    authorizeUrl({ challenge, state, redirectUri: `${env.siteUrl}/api/lichess/callback` }),
  );
  res.cookies.set("lichess_pkce", JSON.stringify({ verifier, state }), {
    httpOnly: true,
    secure: env.siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/lichess",
    maxAge: 600,
  });
  return res;
}
