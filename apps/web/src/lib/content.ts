/** Adresse d'intégration d'une vidéo (YouTube sans cookies ou Vimeo) ; null si non reconnue. */
export function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(
    /^https:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,20})/,
  );
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/^https:\/\/vimeo\.com\/(\d{4,12})/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export type ContentPosition = {
  fen: string;
  caption?: { fr?: string; en?: string };
  solution?: string[];
};

export const LEVELS = ["discovery", "beginner", "intermediate", "advanced", "competition"] as const;
export const THEMES = [
  "rules",
  "tactics",
  "strategy",
  "openings",
  "endgames",
  "competition",
] as const;
