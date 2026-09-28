import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const isDev = process.env.NODE_ENV !== "production";

// CSP stricte : aucune ressource tierce hormis Supabase et les prestataires de paiement déclarés.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline'",
  // Tuiles de la carte « Où jouer » (OpenStreetMap).
  `img-src 'self' data: blob: ${supabaseUrl} https://tile.openstreetmap.org`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")}${process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ? ` ${process.env.NEXT_PUBLIC_PLAUSIBLE_HOST}` : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://checkout.fedapay.com https://sandbox-checkout.fedapay.com https://widget-v3.kkiapay.me https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.fedapay.com https://sandbox-checkout.fedapay.com",
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
