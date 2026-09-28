import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Espaces personnels, administration et pages techniques exclus de l'indexation. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    "/admin",
    "/compte",
    "/api/",
    "/arbitrage",
    "/billet",
    "/paiement",
    "/membre",
    "/connexion",
  ];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...privatePaths, ...privatePaths.map((p) => `/en${p}`)],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
