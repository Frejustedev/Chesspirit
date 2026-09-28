import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chesspirit",
    short_name: "Chesspirit",
    description: "Les échecs au Bénin : cours, tournois, classement.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f1",
    theme_color: "#1c1815",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
