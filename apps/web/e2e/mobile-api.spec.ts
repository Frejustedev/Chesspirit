import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomPhone, readOtp, serviceDb } from "./helpers";

// Compte dédié : évite le délai entre deux codes SMS pour le numéro partagé par les autres tests.
const PHONE = randomPhone();

/** Session obtenue comme dans l'application mobile : code SMS puis jeton d'accès Supabase. */
async function mobileToken() {
  const env = fs.readFileSync(path.resolve(import.meta.dirname, "../.env.local"), "utf8");
  const anon = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)![1]!.trim();
  const sb = createClient("http://localhost:54321", anon, { auth: { persistSession: false } });
  const t = Date.now();
  await sb.auth.signInWithOtp({ phone: PHONE });
  const { data, error } = await sb.auth.verifyOtp({
    phone: PHONE,
    token: await readOtp(PHONE, t),
    type: "sms",
  });
  if (error) throw error;
  return data.session!.access_token;
}

test("API d'inscription de l'application mobile", async ({ request }) => {
  const db = serviceDb();
  const suffix = Date.now().toString(36);
  const { data: created } = await db.auth.admin.createUser({ phone: PHONE, phone_confirm: true });
  const { data: me } = await db
    .from("profiles")
    .insert({
      user_id: created.user!.id,
      first_name: "Mobile",
      last_name: "Test",
      birth_date: "1995-05-05",
      sex: "F",
      city: "Cotonou",
      department: "Littoral",
      phone: PHONE,
      onboarded: true,
    })
    .select("id")
    .single();
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-mobile-${suffix}`,
      name: `Mobile ${suffix}`,
      starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      status: "registration_open",
      entry_fee_xof: 0,
      rounds_count: 5,
    })
    .select("id")
    .single();
  try {
    const body = {
      tournamentId: t!.id,
      playerId: me!.id,
      paymentMethod: "free",
      acceptRules: true,
    };
    expect((await request.post("/api/mobile/register", { data: body })).status()).toBe(401);
    expect(
      (
        await request.post("/api/mobile/register", {
          data: body,
          headers: { authorization: "Bearer jeton.invalide.de.test.xxxxx" },
        })
      ).status(),
    ).toBe(401);

    const token = await mobileToken();
    const auth = { authorization: `Bearer ${token}` };
    expect(
      (
        await request.post("/api/mobile/register", {
          data: { ...body, acceptRules: false },
          headers: auth,
        })
      ).status(),
    ).toBe(400);
    const r = await request.post("/api/mobile/register", { data: body, headers: auth });
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json.ok).toBe(true);
    expect(json.ticketUrl).toMatch(/\/billet\//);
    // Même règle que le site : une seconde demande renvoie la même inscription (pas de doublon).
    const again = await request.post("/api/mobile/register", { data: body, headers: auth });
    expect((await again.json()).ticketUrl).toBe(json.ticketUrl);
    const { count } = await db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", t!.id);
    expect(count).toBe(1);
  } finally {
    await db.from("tournaments").delete().eq("id", t!.id);
    await db.from("profiles").delete().eq("id", me!.id);
    await db.auth.admin.deleteUser(created.user!.id);
  }
});
