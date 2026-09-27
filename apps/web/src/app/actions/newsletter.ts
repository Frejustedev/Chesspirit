"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export async function subscribeNewsletter(_prev: unknown, form: FormData) {
  const parsed = z.string().trim().email().max(200).safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, error: "email_invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.toLowerCase(), locale: await getLocale() });
  // Un doublon n'est pas une erreur visible (pas de fuite d'information sur les inscrits).
  if (error && error.code !== "23505") return { ok: false, error: "server" };
  return { ok: true };
}
