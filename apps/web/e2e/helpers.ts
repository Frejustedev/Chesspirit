import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const OTP_LOG = path.resolve(import.meta.dirname, "../../../.local/logs/otp.log");

/** Lit le dernier code envoyé (pile locale : les codes sont écrits dans .local/logs/otp.log). */
export async function readOtp(identifier: string, after: number): Promise<string> {
  const id = identifier.replace(/^\+/, "");
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(OTP_LOG)) {
      const lines = fs.readFileSync(OTP_LOG, "utf8").trim().split("\n").reverse();
      for (const l of lines) {
        const [ts, , who, code] = l.split(" ");
        if (who === id && Date.parse(ts!) >= after - 1000) return code!;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Aucun code pour ${identifier}`);
}

/**
 * Le serveur d'authentification refuse deux demandes de code au même numéro à moins de 5 s
 * (GOTRUE_SMS_MAX_FREQUENCY) : on attend la fin de ce délai si un code vient d'être envoyé.
 */
async function waitOtpCooldown(identifier: string, cooldownMs = 6000) {
  if (!fs.existsSync(OTP_LOG)) return;
  const id = identifier.replace(/^\+/, "");
  const last = fs
    .readFileSync(OTP_LOG, "utf8")
    .trim()
    .split("\n")
    .reverse()
    .map((l) => l.split(" "))
    .find(([, , who]) => who === id);
  const elapsed = last ? Date.now() - Date.parse(last[0]!) : Infinity;
  if (elapsed < cooldownMs) await new Promise((r) => setTimeout(r, cooldownMs - elapsed));
}

export async function loginWithPhone(page: Page, phone: string, next = "/compte") {
  await page.goto(`/connexion?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/Numéro de téléphone/).fill(phone);
  await waitOtpCooldown(phone);
  const t = Date.now();
  await page.getByRole("button", { name: "Recevoir le code" }).click();
  const code = await readOtp(phone, t);
  await page.getByLabel(/Code à 6 chiffres/).fill(code);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export function randomPhone() {
  return `+22997${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
}

import { createClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";

// Clé de service de démonstration de la CLI Supabase (locale uniquement).
export const serviceDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    { auth: { persistSession: false } },
  );

export async function resetMfa(phone: string) {
  const db = serviceDb();
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const u = data.users.find((x) => x.phone === phone.replace(/^\+/, ""));
  if (!u) throw new Error("utilisateur introuvable");
  const { data: f } = await db.auth.admin.mfa.listFactors({ userId: u.id });
  for (const factor of f?.factors ?? [])
    await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId: u.id });
}

export const totp = (secret: string) =>
  new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" }).generate();

/** Connexion administrateur complète : SMS puis enrôlement TOTP. */
export async function loginAsAdmin(page: Page) {
  const phone = "+22990000009";
  await resetMfa(phone);
  await loginWithPhone(page, phone, "/admin");
  await page.waitForURL(/admin\/securite/);
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
  await page.getByRole("button", { name: "Valider" }).click();
  await page.waitForURL(/\/admin$/);
}
