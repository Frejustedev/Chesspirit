import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";

/** Pays ouverts aux inscriptions (le Bénin seul au lancement ; la sous-région s'ouvre depuis l'administration). */
export async function enabledCountries(locale: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("countries")
    .select("code, name")
    .eq("enabled", true)
    .order("position");
  return (data ?? []).map((c) => ({ code: c.code, name: tr(c.name, locale) }));
}
