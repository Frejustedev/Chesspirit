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

/** Toutes les URL connues de l'arborescence (pour la page « en préparation »). */
export const ALL_NAV_HREFS = new Set<string>([
  ...NAV.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]),
  ...SECONDARY_NAV.map((i) => i.href),
  ...LEGAL_NAV.map((i) => i.href),
]);
