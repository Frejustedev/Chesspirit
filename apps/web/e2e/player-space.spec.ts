import { expect, test } from "@playwright/test";
import { loginWithPhone } from "./helpers";

test("espace joueur : tournois, attestation PDF, parties filtrées, PGN, statistiques, annotations", async ({
  page,
}) => {
  await loginWithPhone(page, "+22990000001", "/compte/tournois");
  await expect(page.getByRole("heading", { name: "Mes tournois" })).toBeVisible();
  const row = page.getByRole("row", { name: /Open de démonstration de Cotonou/ });
  await expect(row).toBeVisible();
  const href = await row.getByRole("link", { name: "PDF" }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.goto("/compte/parties");
  await expect(page.getByText(/^5 parties$/)).toBeVisible();
  await page.getByLabel("Couleur").selectOption("w");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/color=w/);
  const pgn = await page.request.get("/api/me/games");
  expect((await pgn.text()).match(/\[Event /g)).toHaveLength(5);

  await page.goto("/compte/statistiques");
  await expect(page.getByRole("heading", { name: "Résultats par couleur" })).toBeVisible();

  await page.goto("/compte/parties");
  await page.locator("main a[href*='/parties/']").first().click();
  await expect(page.getByRole("heading", { name: "Mes annotations" })).toBeVisible();
  const note = `Note ${Date.now()}`;
  await page.getByLabel("Ajouter").fill(note);
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(note)).toBeVisible();
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();
});

test("les parties d'un autre joueur ne montrent pas d'annotations", async ({ page }) => {
  await page.goto("/competitions/open-demo-cotonou/resultats");
  await page.locator("a[href*='/parties/']").first().click();
  await expect(page.getByRole("heading", { name: "Mes annotations" })).toHaveCount(0);
});
