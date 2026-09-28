import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Origine seule, comme src/lib/env.ts (l'URL copiée du tableau de bord peut finir par /rest/v1/).
const supabaseUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "http://localhost:54321").origin;
  } catch {
    return "http://localhost:54321";
  }
})();
// Statistiques Plausible (facultatives) : le script et ses envois viennent de cet hôte.
const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST
  ? ` ${process.env.NEXT_PUBLIC_PLAUSIBLE_HOST}`
  : "";
const isDev = process.env.NODE_ENV !== "production";

// CSP stricte : aucune ressource tierce hormis Supabase et les prestataires de paiement déclarés.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} 'wasm-unsafe-eval'${plausible}`,
  "style-src 'self' 'unsafe-inline'",
  // Tuiles de la carte « Où jouer » (OpenStreetMap).
  `img-src 'self' data: blob: ${supabaseUrl} https://tile.openstreetmap.org`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")}${plausible}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://checkout.fedapay.com https://sandbox-checkout.fedapay.com https://widget-v3.kkiapay.me https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  // Lichess : redirection OAuth depuis le formulaire « Lier mon compte ».
  "form-action 'self' https://checkout.fedapay.com https://sandbox-checkout.fedapay.com https://lichess.org",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@chesspirit/shared"],
  serverExternalPackages: ["@react-pdf/renderer"],
  typedRoutes: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self), payment=(self)",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
