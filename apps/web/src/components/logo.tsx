/**
 * Logotype provisoire : « Chesspirit » en Fraunces, le « s » central (partagé entre
 * chess et spirit) en or. Remplaçable en un seul endroit.
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
      className={`font-display font-semibold tracking-[-0.02em] ${tone === "dark" ? "text-fg" : "text-cream"} ${className}`}
      style={{ fontVariationSettings: '"opsz" 72, "SOFT" 30' }}
    >
      Ches
      <span
        className={tone === "dark" ? "text-accent" : "text-gold"}
        style={{ fontStyle: "italic" }}
      >
        s
      </span>
      pirit
    </span>
  );
}
