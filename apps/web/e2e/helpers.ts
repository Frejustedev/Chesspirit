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

export async function loginWithPhone(page: Page, phone: string, next = "/compte") {
  await page.goto(`/connexion?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/Numéro de téléphone/).fill(phone);
  const t = Date.now();
  await page.getByRole("button", { name: "Recevoir le code" }).click();
  const code = await readOtp(phone, t);
  await page.getByLabel(/Code à 6 chiffres/).fill(code);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export function randomPhone() {
  return `+22997${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
}
