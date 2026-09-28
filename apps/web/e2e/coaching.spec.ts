import { expect, test } from "@playwright/test";
import { loginWithPhone, serviceDb } from "./helpers";

test("coaching : filtres, réservation payée, suivi par le coach", async ({ page, browser }) => {
  test.setTimeout(150_000);
  // Créneau libre garanti pour les offres en ligne (les créneaux de démonstration s'épuisent au fil des exécutions).
  const db = serviceDb();
  const { data: offers } = await db
    .from("offers")
    .select("coach_id")
    .eq("modality", "online")
    .eq("level", "intermediate")
    .eq("is_active", true);
  const start = new Date(Date.now() + 3 * 86400000 + Math.floor(Math.random() * 3600) * 1000);
  await db.from("availability_slots").insert(
    [...new Set((offers ?? []).map((o) => o.coach_id))].map((coach_id) => ({
      coach_id,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 3600000).toISOString(),
      modality: "online",
    })),
  );
  await page.goto("/coaching?langue=fon");
  await expect(page.getByText("Atelier découverte pour enfants")).toBeVisible();
  await expect(page.getByText("Préparation de tournoi")).toHaveCount(0);

  await loginWithPhone(page, "+22990000001", "/coaching?modalite=online&niveau=intermediate");
  await page.getByRole("link", { name: "Réserver" }).first().click();
  await page
    .locator("label")
    .filter({ hasText: /\d{2}:\d{2}/ })
    .first()
    .click();
  await page.getByLabel("Message pour le coach").fill("Je voudrais travailler la tactique.");
  await page.getByRole("button", { name: "Réserver et payer" }).click();
  await expect(page.getByRole("heading", { name: "Paiement simulé" })).toBeVisible();
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible();
  await page.goto("/compte/cours");
  await expect(page.getByText(/confirmé/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Rejoindre la visio" }).first()).toBeVisible();

  // Le coach (Kossi démo n'a pas de compte) : on utilise le coach démo avec compte si l'offre est la sienne.
  const coachPage = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await loginWithPhone(coachPage, "+22990000003", "/compte/coach");
  await expect(coachPage.getByRole("heading", { name: "Espace coach" })).toBeVisible();
  await coachPage.getByRole("button", { name: "Nouvelle offre" }).click();
  await coachPage.locator("#new-title").fill(`Offre E2E ${Date.now()}`);
  await coachPage.locator("#new-title").press("Enter");
  await expect(coachPage.getByText("Enregistré.").first()).toBeVisible();
});

test("test de niveau et demande de devis", async ({ page }) => {
  await page.goto("/coaching/test-de-niveau");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Je ne trouve pas" }).click();
    await page
      .getByRole("button", { name: i < 4 ? "Position suivante" : "Voir mon niveau" })
      .click();
  }
  await expect(page.getByText("Découverte")).toBeVisible();
  await page.getByRole("link", { name: "Voir les cours de ce niveau" }).click();
  await expect(page).toHaveURL(/niveau=discovery/);

  await page.goto("/coaching/ecoles-entreprises");
  await page.getByLabel("Structure").fill("École démo");
  await page.getByLabel("Votre nom").fill("Directrice Démo");
  await page.getByLabel("Téléphone").fill("+22990000077");
  await page.getByRole("button", { name: "Demander un devis" }).click();
  await expect(page.getByText("Merci ! Nous revenons vers vous rapidement.")).toBeVisible();
});
