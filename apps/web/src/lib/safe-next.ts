/** N'accepte qu'un chemin interne (évite les redirections ouvertes). */
export function safeNext(next: string | null | undefined, fallback = "/compte"): string {
  // Caractères de contrôle et antislash : les navigateurs les ignorent ou les normalisent (« /\t/evil.com »).
  if (!next || !next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  const base = "https://chesspirit.invalid";
  try {
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
