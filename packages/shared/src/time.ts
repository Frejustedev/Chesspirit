/** Fuseau d'affichage : toutes les dates sont stockées en UTC. */
export const TIME_ZONE = "Africa/Porto-Novo" as const;

export function formatDate(
  iso: string | Date,
  locale: string = "fr",
  opts: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    timeZone: TIME_ZONE,
    ...opts,
  }).format(d);
}

export function formatDateTime(iso: string | Date, locale: string = "fr"): string {
  return formatDate(iso, locale, { dateStyle: "long", timeStyle: "short" });
}

/** Découpe un intervalle en jours, heures, minutes, secondes (compte à rebours). */
export function countdownParts(target: Date, now: Date = new Date()) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(ms / 1000);
  return {
    done: ms === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** Âge révolu à une date donnée (pour les catégories et la protection des mineurs). */
export function ageOn(birthDate: string, on: Date = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function isMinor(birthDate: string, on: Date = new Date()): boolean {
  return ageOn(birthDate, on) < 18;
}
