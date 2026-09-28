"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function saveNotificationPrefsAction(raw: unknown) {
  const session = await getSession();
  if (!session?.profile) return { ok: false as const, error: "auth_required" };
  const p = z
    .object({ email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean() })
    .safeParse(raw);
  if (!p.success) return { ok: false as const, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: p.data })
    .eq("id", session.profile.id);
  if (error) return { ok: false as const, error: "server" };
  revalidatePath("/compte/notifications");
  return { ok: true as const };
}
