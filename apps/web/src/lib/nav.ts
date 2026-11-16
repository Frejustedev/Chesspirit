/** Arborescence du site (dossier de projet, section 02). Les libellés passent par l'i18n. */
export type NavItem = { key: string; href: string };
export type NavSection = { key: string; href: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    key: "coaching",
    href: "/coaching",
    items: [
      { key: "programs", href: "/coaching" },
      { key: "coaches", href: "/coaching/coachs" },
      { key: "placement", href: "/coaching/test-de-niveau" },
      { key: "book", href: "/coaching/reserver" },
      { key: "schools", href: "/coaching/ecoles-entreprises" },
      { key: "becomeCoach", href: "/coaching/devenir-coach" },
    ],
  },
  {
    key: "competitions",
    href: "/competitions",
    items: [
      { key: "calendar", href: "/competitions" },
      { key: "leagues", href: "/competitions/ligues" },
      { key: "tour", href: "/competitions/tour" },
      { key: "teams", href: "/competitions/equipes" },
      { key: "live", href: "/competitions/direct" },
      { key: "archives", href: "/competitions/archives" },
    ],
  },
  {
    key: "rankings",
    href: "/classements",
    items: [
      { key: "rating", href: "/classements" },
      { key: "fide", href: "/classements/fide" },
      { key: "leagueRankings", href: "/classements/ligues" },
      { key: "tourRankings", href: "/classements/tour" },
      { key: "method", href: "/classements/methode" },
    ],
  },
  {
    key: "directory",
    href: "/annuaire",
    items: [
      { key: "players", href: "/annuaire/joueurs" },
      { key: "coachesDir", href: "/annuaire/entraineurs" },
      { key: "arbiters", href: "/annuaire/arbitres" },
      { key: "clubs", href: "/annuaire/clubs" },
      { key: "map", href: "/annuaire/carte" },
      { key: "jobs", href: "/annuaire/emplois" },
      { key: "propose", href: "/annuaire/proposer" },
    ],
  },
  {
    key: "shop",
    href: "/boutique",
    items: [
      { key: "boards", href: "/boutique/echiquiers" },
      { key: "clocksBooks", href: "/boutique/pendules-livres" },
      { key: "accessories", href: "/boutique/accessoires" },
      { key: "packs", href: "/boutique/packs" },
      { key: "rental", href: "/boutique/location" },
      { key: "orderTracking", href: "/boutique/suivi" },
    ],
  },
  {
    key: "media",
    href: "/media",
    items: [
      { key: "videos", href: "/media/videos" },
      { key: "podcasts", href: "/media/podcasts" },
      { key: "liveMedia", href: "/media/direct" },
      { key: "shows", href: "/media/emissions" },
      { key: "articles", href: "/media/articles" },
    ],
  },
  {
    key: "academy",
    href: "/academie",
    items: [
      { key: "lessons", href: "/academie/lecons" },
      { key: "puzzle", href: "/academie/puzzle-du-jour" },
      { key: "resources", href: "/academie/ressources" },
      { key: "lexicon", href: "/academie/lexique" },
      { key: "premium", href: "/academie/premium" },
    ],
  },
  {
    key: "community",
    href: "/communaute",
    items: [
      { key: "membership", href: "/communaute/adhesion" },
      { key: "badges", href: "/communaute/badges" },
      { key: "ambassadors", href: "/communaute/ambassadeurs" },
      { key: "predictions", href: "/communaute/pronostics" },
      { key: "pvm", href: "/communaute/public-contre-le-maitre" },
      { key: "awards", href: "/communaute/awards" },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { key: "about", href: "/a-propos" },
  { key: "contact", href: "/contact" },
  { key: "faq", href: "/faq" },
];

export const LEGAL_NAV: NavItem[] = [
  { key: "legalNotice", href: "/legal/mentions-legales" },
  { key: "terms", href: "/legal/cgu" },
  { key: "sales", href: "/legal/cgv" },
  { key: "privacy", href: "/legal/confidentialite" },
  { key: "cookies", href: "/legal/cookies" },
  { key: "refunds", href: "/legal/remboursements" },
  { key: "rules", href: "/legal/reglement-tournois" },
];

/** Lettre de colonne de chaque rubrique, de a à h, comme sur la rangée de départ de l'accueil. */
export const FILES = "abcdefgh";

/** Pages rattachées à une rubrique sans figurer dans son menu. */
const ATTACHED: Record<string, string> = {
  "/parties": "competitions",
  "/billet": "competitions",
  "/arbitrage": "competitions",
  "/joueurs": "rankings",
  "/membre": "community",
};

/** Zones hors des huit rubriques, nommées dans le titre courant. */
const AREAS: Record<string, PageArea> = {
  "/admin": "admin",
  "/compte": "account",
  "/connexion": "account",
  "/legal": "legal",
  "/a-propos": "info",
  "/contact": "info",
  "/faq": "info",
  "/recherche": "search",
};

export type PageArea = "admin" | "account" | "legal" | "info" | "search";

export type PageLocation = {
  /** Rubrique (une des huit), avec sa lettre de colonne. */
  section: { key: string; href: string; file: string } | null;
  /** Page de la rubrique ou d'information la plus proche (clé de `nav.items`). */
  item: NavItem | null;
  /** Zone hors rubrique (administration, espace personnel…). */
  area: PageArea | null;
};

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Situe une page (chemin sans préfixe de langue) dans l'arborescence, pour le titre courant. */
export function locatePage(pathname: string): PageLocation {
  const path = pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  const longest = (items: NavItem[]) =>
    items.filter((i) => under(path, i.href)).sort((a, b) => b.href.length - a.href.length)[0] ??
    null;

  const attached = Object.entries(ATTACHED).find(([href]) => under(path, href))?.[1];
  const index = NAV.findIndex((s) => under(path, s.href) || s.key === attached);
  if (index >= 0) {
    const s = NAV[index]!;
    return {
      section: { key: s.key, href: s.href, file: FILES[index]! },
      item: longest(s.items),
      area: null,
    };
  }
  const area = Object.entries(AREAS).find(([href]) => under(path, href))?.[1] ?? null;
  return {
    section: null,
    item: longest([...SECONDARY_NAV, ...LEGAL_NAV]),
    area,
  };
}

/** Toutes les URL connues de l'arborescence (pour la page « en préparation »). */
export const ALL_NAV_HREFS = new Set<string>([
  ...NAV.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]),
  ...SECONDARY_NAV.map((i) => i.href),
  ...LEGAL_NAV.map((i) => i.href),
]);
