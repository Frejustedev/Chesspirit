import "server-only";
import crypto from "node:crypto";

/**
 * Lichess : liaison de compte par OAuth avec PKCE (aucun secret client, aucune clé stockée),
 * lecture publique des résultats et des parties, création de tournois avec le jeton
 * du compte Chesspirit (LICHESS_API_TOKEN, facultatif).
 * LICHESS_FAKE=true : mode factice pour le développement et les tests (aucun appel réseau).
 */
export const LICHESS_HOST = process.env.LICHESS_HOST ?? "https://lichess.org";
export const LICHESS_CLIENT_ID = process.env.LICHESS_CLIENT_ID ?? "chesspirit.com";
/** Mode factice : jamais en production (il permettrait de lier n'importe quel compte Lichess). */
export const lichessFake = () =>
  process.env.LICHESS_FAKE === "true" &&
  process.env.VERCEL_ENV !== "production" &&
  !isProductionSite();
function isProductionSite() {
  return /^https:\/\/(www\.)?chesspirit\.com\/?$/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
}
export const lichessCanCreate = () => !!process.env.LICHESS_API_TOKEN || lichessFake();

const b64url = (b: Buffer) => b.toString("base64url");

export function pkcePair() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge, state: b64url(crypto.randomBytes(24)) };
}

export function authorizeUrl(opts: { challenge: string; state: string; redirectUri: string }) {
  const u = new URL("/oauth", LICHESS_HOST);
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: LICHESS_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    code_challenge_method: "S256",
    code_challenge: opts.challenge,
    state: opts.state,
  }).toString();
  return u.toString();
}

/** Échange du code puis lecture de l'identité ; le jeton est révoqué aussitôt (pas de conservation). */
export async function identityFromCode(code: string, verifier: string, redirectUri: string) {
  const tok = await fetch(`${LICHESS_HOST}/api/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: LICHESS_CLIENT_ID,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tok.ok) throw new Error("lichess_token_failed");
  const { access_token } = (await tok.json()) as { access_token: string };
  const acc = await fetch(`${LICHESS_HOST}/api/account`, {
    headers: { authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  await fetch(`${LICHESS_HOST}/api/token`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${access_token}` },
  }).catch(() => undefined);
  if (!acc.ok) throw new Error("lichess_account_failed");
  const a = (await acc.json()) as { id: string; username: string };
  return { id: a.id, username: a.username };
}

export type LichessResult = { rank: number; username: string; points: number; rating?: number };

function ndjson<T>(text: string): T[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

/** Classement final d'un tournoi Lichess (Arena ou suisse). */
export async function fetchResults(kind: "arena" | "swiss", id: string): Promise<LichessResult[]> {
  const path = kind === "arena" ? `/api/tournament/${id}/results` : `/api/swiss/${id}/results`;
  const res = await fetch(`${LICHESS_HOST}${path}`, {
    headers: { accept: "application/x-ndjson" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`lichess_results_${res.status}`);
  return ndjson<{
    rank: number;
    username: string;
    score?: number;
    points?: number;
    rating?: number;
  }>(await res.text()).map((r) => ({
    rank: r.rank,
    username: r.username,
    points: r.points ?? r.score ?? 0,
    rating: r.rating,
  }));
}

/** Parties d'un tournoi Lichess au format PGN. */
export async function fetchGamesPgn(kind: "arena" | "swiss", id: string): Promise<string> {
  const path = kind === "arena" ? `/api/tournament/${id}/games` : `/api/swiss/${id}/games`;
  const res = await fetch(`${LICHESS_HOST}${path}?clocks=false&evals=false&opening=true`, {
    headers: { accept: "application/x-chess-pgn" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`lichess_games_${res.status}`);
  return res.text();
}

/** Création d'une Arena sur Lichess avec le compte Chesspirit. */
export async function createArena(p: {
  name: string;
  clockMinutes: number;
  incrementSeconds: number;
  durationMinutes: number;
  startsAt: string;
  description?: string;
}): Promise<string> {
  if (lichessFake()) return `fake${crypto.randomBytes(3).toString("hex")}`;
  const token = process.env.LICHESS_API_TOKEN;
  if (!token) throw new Error("lichess_not_configured");
  const res = await fetch(`${LICHESS_HOST}/api/tournament`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      name: p.name.slice(0, 30),
      clockTime: String(p.clockMinutes),
      clockIncrement: String(p.incrementSeconds),
      minutes: String(p.durationMinutes),
      startDate: String(Date.parse(p.startsAt)),
      rated: "true",
      description: p.description ?? "",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`lichess_create_${res.status}`);
  return ((await res.json()) as { id: string }).id;
}
