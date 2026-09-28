import { expect, test } from "@playwright/test";

/**
 * Test de fumée, en lecture seule, à lancer contre la production :
 *   E2E_BASE_URL=https://chesspirit.com pnpm --filter web exec playwright test --project=smoke
 * Aucun compte n'est créé, aucun paiement ni message n'est déclenché.
 */
test.describe("fumée", () => {
  test("service et base disponibles", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    expect((await r.json()).status).toBe("ok");
  });

  test("en-têtes de sécurité", async ({ request }) => {
    const r = await request.get("/");
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["content-security-policy"]).toBeTruthy();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    if (r.url().startsWith("https://")) expect(h["strict-transport-security"]).toBeTruthy();
  });

  test("pages publiques principales", async ({ page }) => {
    for (const [path, heading] of [
      ["/", /\S/],
      ["/competitions", /Calendrier|Compétitions/i],
      ["/classements", /Classement|Cote/i],
      ["/boutique", /Boutique/i],
      ["/academie", /Académie/i],
      ["/communaute", /Communauté/i],
      ["/en", /\S/],
    ] as const) {
      const r = await page.goto(path);
      expect(r?.status(), path).toBeLessThan(400);
      await expect(page.locator("h1").first(), path).toContainText(heading);
    }
  });

  test("espaces protégés", async ({ page }) => {
    await page.goto("/compte");
    await expect(page).toHaveURL(/connexion/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/connexion/);
  });

  test("référencement", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Sitemap:");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  test("webhooks protégés", async ({ request }) => {
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
    expect(
      (await request.post("/api/webhooks/payments/fedapay", { data: "{}" })).status(),
    ).toBeGreaterThanOrEqual(400);
  });
});
