import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { env } from "./lib/env";
import { REFERRAL_COOKIE, REFERRAL_RE } from "./lib/referral";

const intl = createMiddleware(routing);

/** Rafraîchit la session Supabase puis applique le routage par langue. */
export default async function proxy(request: NextRequest) {
  const response =
    request.nextUrl.pathname.startsWith("/api") || request.nextUrl.pathname.startsWith("/auth")
      ? NextResponse.next({ request })
      : intl(request);

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const referral = request.nextUrl.searchParams.get("parrain")?.toUpperCase();
  if (referral && REFERRAL_RE.test(referral))
    response.cookies.set(REFERRAL_COOKIE, referral, {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  // Ne rien intercaler ici : getUser() rafraîchit le jeton si nécessaire.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
