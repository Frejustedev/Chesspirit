/**
 * Logotype provisoire, dessiné comme sur la couverture et le dos du dossier de projet :
 * « Chesspirit » en Fraunces maigre, le « s » central (partagé entre chess et spirit) en or.
 * Remplaçable en un seul endroit.
 */
export function Logo({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={`font-display font-light tracking-[-0.025em] ${tone === "dark" ? "text-fg" : "text-cream"} ${className}`}
      style={{ fontVariationSettings: '"opsz" 144' }}
    >
      Ches<span className="text-gold">s</span>pirit
    </span>
  );
}
