/** Assistant WhatsApp : reconnaissance d'intention par mots-clés (français, anglais, sans accents). */
export type Intent =
  | { kind: "next_tournament" }
  | { kind: "ranking" }
  | { kind: "rating"; name: string }
  | { kind: "registration" }
  | { kind: "coaching" }
  | { kind: "human" }
  | { kind: "stop" }
  | { kind: "help" };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detectIntent(text: string): Intent {
  const t = norm(text.slice(0, 500));
  const rating = t.match(/^(?:cote|elo|rating|classement de|niveau de)\s+(.{2,40})$/);
  if (rating) return { kind: "rating", name: rating[1]!.trim() };
  if (/\b(stop|arret|desinscri|unsubscribe)\b/.test(t)) return { kind: "stop" };
  if (/\b(humain|agent|conseiller|parler|human|contact)\b/.test(t)) return { kind: "human" };
  if (/\b(inscri|register|billet|ticket)/.test(t)) return { kind: "registration" };
  if (/\b(cours|coach|lecon|lesson|entrain)/.test(t)) return { kind: "coaching" };
  if (/\b(classement|ranking|top|meilleur)/.test(t)) return { kind: "ranking" };
  if (/\b(tournoi|tournament|prochain|next|competition|quand|when)\b/.test(t))
    return { kind: "next_tournament" };
  return { kind: "help" };
}
