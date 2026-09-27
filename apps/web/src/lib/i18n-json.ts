import type { Json } from "@/lib/supabase/types";

/** Lit un champ traduit stocké en JSON {fr, en}, avec repli sur le français. */
export function tr(value: Json | null | undefined, locale: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return typeof value === "string" ? value : "";
  const v = value as Record<string, Json | undefined>;
  return String(v[locale] ?? v.fr ?? v.en ?? "");
}
