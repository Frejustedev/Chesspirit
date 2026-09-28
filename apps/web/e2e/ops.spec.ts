import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("tâches planifiées : jeton obligatoire", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/reminders", {
        headers: { authorization: "Bearer mauvais-jeton-12345678" },
      })
    ).status(),
  ).toBe(401);
});

test("préférences de notification", async ({ page }) => {
  await loginWithPhone(page, "+22990000001", "/compte/notifications");
  await page.waitForURL(/compte\/notifications/);
  await page.getByLabel("Par e-mail").uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Par e-mail")).not.toBeChecked();
  await page.getByLabel("Par e-mail").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
});

test("statistiques et arbitrage hors ligne", async ({ page, context }) => {
  test.setTimeout(180_000);
  const db = serviceDb();
  const suffix = Date.now().toString(36);
  const { data: players } = await db
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .is("user_id", null)
    .limit(2);
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-hors-ligne-${suffix}`,
      name: `Hors ligne ${suffix}`,
      starts_at: new Date().toISOString(),
      status: "ongoing",
      rounds_count: 1,
    })
    .select("id")
    .single();
  const { data: round } = await db
    .from("rounds")
    .insert({
      tournament_id: t!.id,
      number: 1,
      status: "ongoing",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const { data: pairing } = await db
    .from("pairings")
    .insert({
      tournament_id: t!.id,
      round_id: round!.id,
      board: 1,
      white_id: players![0]!.id,
      black_id: players![1]!.id,
    })
    .select("id")
    .single();

  await loginAsAdmin(page);
  await page.goto("/admin/statistiques");
  await expect(page.getByRole("heading", { name: "Statistiques" })).toBeVisible();
  await expect(page.getByText("Profils", { exact: true })).toBeVisible();

  await page.goto(`/arbitrage/${t!.id}`);
  await expect(page.getByRole("heading", { name: "Ronde 1" })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/Hors ligne/).first()).toBeVisible();
  await page.getByRole("button", { name: "Échiquier 1 : 1-0" }).click();
  await expect(page.getByText("1 résultat en attente d'envoi", { exact: false })).toBeVisible();
  const { data: before } = await db
    .from("pairings")
    .select("result")
    .eq("id", pairing!.id)
    .single();
  expect(before?.result).toBeNull();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("1 résultat envoyé")).toBeVisible({ timeout: 15_000 });
  const { data: after } = await db.from("pairings").select("result").eq("id", pairing!.id).single();
  expect(after?.result).toBe("1-0");
  await db.from("tournaments").delete().eq("id", t!.id);
});
