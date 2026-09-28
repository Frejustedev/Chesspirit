import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("média et académie : émissions, épisode, leçon jouable, puzzle du jour, lexique", async ({
  page,
}) => {
  await page.goto("/media");
  await expect(page.getByRole("link", { name: /Le Coup de la semaine/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Échecs en fon/ })).toBeVisible();
  await page.goto("/media/episodes/coup-de-la-semaine-demo-1");
  await expect(page.getByRole("heading", { name: "Positions à rejouer" })).toBeVisible();
  await expect(page.getByText("Vidéo à venir.")).toBeVisible();

  await page.goto("/academie/lecons?niveau=beginner");
  await page.getByRole("link", { name: /Le mat du couloir/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Le mat du couloir" })).toBeVisible();
  await page.goto("/academie/puzzle-du-jour");
  await expect(page.getByRole("heading", { name: /Défi de la semaine/ })).toBeVisible();
  await page.goto("/academie/lexique?categorie=pieces");
  await expect(page.getByRole("cell", { name: "Cavalier" })).toBeVisible();
});

test("rédaction : suggestion en fon validée, article publié", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const suffix = Date.now().toString(36);
  const reader = await (await browser.newContext()).newPage();
  await loginWithPhone(reader, "+22990000001", "/academie/lexique?categorie=pieces");
  await reader.waitForURL(/academie\/lexique/);
  const row = reader.getByRole("row", { name: /Pion/ });
  await row.getByRole("button", { name: "Proposer une traduction" }).click();
  await row.getByPlaceholder("Terme en fon").fill(`fon-${suffix}`);
  await row.getByRole("button", { name: "Envoyer" }).click();
  await expect(row.getByText("Merci, votre proposition sera relue.")).toBeVisible();

  await loginAsAdmin(page);
  await page.goto("/admin/contenus?onglet=glossary");
  const s = page.locator("li", { hasText: `fon-${suffix}` });
  await s.getByRole("button", { name: "Valider" }).click();
  await expect(page.locator("li", { hasText: `fon-${suffix}` })).toHaveCount(0);

  await page.goto("/admin/contenus?onglet=articles&id=nouveau");
  await page.getByLabel("Adresse (slug)").fill(`article-${suffix}`);
  await page.getByLabel("Statut").selectOption("published");
  await page.getByLabel("Titre (FR)").fill(`Article de test ${suffix}`);
  await page.getByLabel("Texte (Markdown) (FR)").fill("## Titre\n\nUn paragraphe **important**.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/id=[0-9a-f-]{36}/);
  await page.goto(`/media/articles/article-${suffix}`);
  await expect(
    page.getByRole("heading", { level: 1, name: `Article de test ${suffix}` }),
  ).toBeVisible();
  await page.goto("/academie/lexique?categorie=pieces");
  await expect(page.getByRole("cell", { name: `fon-${suffix}` })).toBeVisible();

  // Remise en état : terme fon et suggestion de test retirés.
  const db = serviceDb();
  await db
    .from("glossary_terms")
    .update({ term_fon: null, fon_status: "missing" })
    .eq("term_fon", `fon-${suffix}`);
  await db.from("glossary_suggestions").delete().eq("term_fon", `fon-${suffix}`);
  await db.from("articles").delete().eq("slug", `article-${suffix}`);
});
