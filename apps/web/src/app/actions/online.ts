"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { createArena, lichessFake } from "@/lib/lichess";
import { importLichessTournament } from "@/lib/lichess-import";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();

export async function setLichessLinkAction(
  tournamentId: string,
  kind: "arena" | "swiss",
  lichessId: string,
): Promise<Result> {
  const id = lichessId.trim().replace(/^https?:\/\/lichess\.org\/(tournament|swiss)\//, "");
  if (
    !uuid.safeParse(tournamentId).success ||
    !["arena", "swiss"].includes(kind) ||
    !/^[A-Za-z0-9]{4,16}$/.test(id)
  )
    return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .update({ lichess_kind: kind, lichess_id: id })
    .eq("id", tournamentId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath(`/admin/tournois/${tournamentId}`);
  return { ok: true };
}

/** Création de l'Arena sur Lichess (compte Chesspirit), puis liaison au tournoi. */
export async function createLichessArenaAction(tournamentId: string): Promise<Result<string>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, base_minutes, increment_seconds, starts_at, ends_at")
    .eq("id", tournamentId)
    .single();
  if (!t) return { ok: false, error: "forbidden" };
  const duration = t.ends_at
    ? Math.min(
        720,
        Math.max(20, Math.round((Date.parse(t.ends_at) - Date.parse(t.starts_at)) / 60000)),
      )
    : 90;
  try {
    const id = await createArena({
      name: t.name,
      clockMinutes: t.base_minutes ?? 3,
      incrementSeconds: t.increment_seconds ?? 2,
      durationMinutes: duration,
      startsAt: t.starts_at,
      description: "Chesspirit",
    });
    const { data, error } = await supabase
      .from("tournaments")
      .update({ lichess_kind: "arena", lichess_id: id })
      .eq("id", tournamentId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "forbidden" };
    revalidatePath(`/admin/tournois/${tournamentId}`);
    return { ok: true, data: id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function importLichessAction(
  tournamentId: string,
): Promise<Result<{ players: number; unknown: string[]; games: number }>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  try {
    const r = await importLichessTournament(supabase, tournamentId);
    revalidatePath(`/admin/tournois/${tournamentId}`);
    revalidatePath("/competitions", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Mode factice uniquement : liaison directe d'un nom d'utilisateur (tests et démonstration). */
export async function fakeLinkLichessAction(username: string): Promise<Result> {
  if (!lichessFake()) return { ok: false, error: "disabled" };
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const u = username.trim();
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(u)) return { ok: false, error: "invalid" };
  const { error } = await createAdminClient()
    .from("lichess_accounts")
    .upsert(
      { profile_id: session.profile.id, username: u, lichess_id: u.toLowerCase() },
      { onConflict: "profile_id" },
    );
  if (error) return { ok: false, error: error.code === "23505" ? "already_linked" : "server" };
  revalidatePath("/compte/profil");
  return { ok: true };
}

export async function unlinkLichessAction(): Promise<Result> {
  const session = await getSession();
  if (!session?.profile) return { ok: false, error: "auth_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lichess_accounts")
    .delete()
    .eq("profile_id", session.profile.id);
  if (error) return { ok: false, error: "server" };
  revalidatePath("/compte/profil");
  return { ok: true };
}
