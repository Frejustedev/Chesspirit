export const ORG_TYPES = [
  "club",
  "school",
  "organizer",
  "association",
  "departmental_league",
  "federation",
  "vendor",
  "content_creator",
  "media",
  "university",
  "company",
] as const;
export type OrgType = (typeof ORG_TYPES)[number];
