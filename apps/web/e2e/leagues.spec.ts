import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("ligues et Tour : pages publiques de la saison de démonstration", async ({ page }) => {
  await page.goto("/competitions/ligues?saison=saison-demo");
  await expect(page.getByRole("heading", { name: "Ligues", exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: /60 min \+ 30 s/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /Ligue 1 · Classique/ })).toBeVisible();
  await expect(page.getByText("Champion").first()).toBeVisible();
  await expect(page.getByText("descente").first()).toBeVisible();

  await page.goto("/competitions/tour?saison=saison-demo");
  await expect(page.getByText("Majeure × 1,5")).toBeVisible();
  await page.goto("/classements/tour?saison=saison-demo&categorie=u18");
  await expect(page.getByRole("link", { name: "Moins de 18 ans" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/classements/ligues?saison=saison-demo");
  await expect(page.getByRole("heading", { name: "Classements des ligues" })).toBeVisible();
});

test("administration des ligues : saison, membre, journée, licence payée", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const slug = `e2e-${Date.now().toString(36)}`;
  await loginAsAdmin(page);
  await page.goto("/admin/ligues");
  await page.getByRole("button", { name: "Nouvelle saison" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(`Saison ${slug}`);
  await page.getByLabel("Identifiant", { exact: true }).fill(slug);
  await page.getByLabel("Début").fill("2027-09-01");
  await page.getByLabel("Fin").fill("2028-06-30");
  await page.getByRole("button", { name: "Créer la saison et ses 9 ligues" }).click();
  await page.waitForURL(new RegExp(`saison=${slug}`));
  await page.getByLabel("Licence (F CFA)").fill("3000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré.")).toBeVisible();

  // Membre ajouté par téléphone, puis journée créée avec l'inscription d'office.
  await page.locator("summary", { hasText: "Membres" }).first().click();
  await page
    .getByPlaceholder("Téléphone (+229…) ou identifiant de profil")
    .first()
    .fill("+22990000001");
  await page.getByRole("button", { name: "Ajouter", exact: true }).first().click();
  await expect(page.getByText("Ajouté.").first()).toBeVisible();
  await page.getByRole("button", { name: "Créer la journée suivante" }).first().click();
  await page.waitForURL(/admin\/tournois\//);
  await expect(page.getByText(/journée 1/).first()).toBeVisible();

  // Le joueur prend sa licence et la paie (paiement simulé).
  const player = await (await browser.newContext()).newPage();
  await loginWithPhone(player, "+22990000001", "/compte/ligues");
  await player.waitForURL(/compte\/ligues/);
  const block = player.locator("li", { hasText: `Saison ${slug}` });
  await block.getByRole("button", { name: "Prendre la licence" }).first().click();
  await expect(player.getByRole("heading", { name: "Paiement simulé" })).toBeVisible();
  await player.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(player.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible({
    timeout: 20_000,
  });
  await player.goto("/compte/ligues");
  await expect(
    player
      .locator("li", { hasText: `Saison ${slug}` })
      .getByText("Licence active")
      .first(),
  ).toBeVisible();

  // Régression : les réglages enregistrés visent la saison affichée, pas la précédente.
  const { data: real } = await serviceDb()
    .from("seasons")
    .select("license_fee_xof")
    .eq("slug", "2026-2027")
    .single();
  expect(real?.license_fee_xof).toBeNull();

  // Nettoyage : la saison de test est close (n'apparaît plus aux joueurs).
  await serviceDb().from("seasons").update({ status: "closed" }).eq("slug", slug);
});
