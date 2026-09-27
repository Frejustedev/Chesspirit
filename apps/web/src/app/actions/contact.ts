"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  topic: z.string().max(40),
  message: z.string().trim().min(5).max(5000),
  website: z.string().max(0).optional().or(z.literal("")),
});

export async function sendContact(_prev: unknown, form: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false as const };
  const { website, ...v } = parsed.data;
  if (website) return { ok: true as const }; // robot : on fait comme si
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .insert({ ...v, email: v.email || null, phone: v.phone || null });
  return error ? { ok: false as const } : { ok: true as const };
}
