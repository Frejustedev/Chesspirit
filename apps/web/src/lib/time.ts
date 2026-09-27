/** Heure courante côté serveur (isolée pour les composants serveur et les tests). */
export function currentTime(): number {
  return Date.now();
}
