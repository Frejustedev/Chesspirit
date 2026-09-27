import { expect, test } from "@playwright/test";
import { loginWithPhone, randomPhone } from "./helpers";

test("nouveau joueur : connexion SMS, profil, inscription payante, paiement test, billet", async ({ page }) => {
  const phone = randomPhone();
  await loginWithPhone(page, phone, "/competitions/blitz-demo-porto-novo/inscription");

  // Création du profil (redirection automatique puis retour vers l'inscription)
  await expect(page.getByRole("heading", { name: "Bienvenue sur Chesspirit" })).toBeVisible();
  await page.getByLabel("Prénom").fill("Test");
  await page.getByLabel("Nom", { exact: true }).fill("Parcours");
  await page.getByLabel("Date de naissance").fill("1999-04-05");
  await page.getByLabel("Sexe").selectOption("F");
  await page.getByLabel("Ville").fill("Cotonou");
  await page.getByLabel("Département").selectOption("Littoral");
  await page.getByLabel(/J'accepte les conditions générales/).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();

  await expect(page.getByRole("heading", { name: "Inscription" })).toBeVisible();
  await page.getByLabel("Taille de t-shirt").selectOption("M");
  await page.getByLabel(/Payer maintenant/).check();
  await page.getByLabel(/J'accepte le/).check();
  await page.getByRole("button", { name: "Continuer vers le paiement" }).click();

  await expect(page.getByRole("heading", { name: "Paiement simulé" })).toBeVisible();
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible();
  await page.getByRole("link", { name: "Voir mon billet" }).click();
  await expect(page.getByText("Test Parcours")).toBeVisible();
  await expect(page.getByText("Confirmée")).toBeVisible();
  await expect(page.getByText("Payé")).toBeVisible();

  // La liste publique affiche le nouvel inscrit
  await page.goto("/competitions/blitz-demo-porto-novo");
  await expect(page.getByRole("cell", { name: /Test Parcours/ })).toBeVisible();
});

test("tournoi du 3 octobre : frais à confirmer, inscription avec paiement sur place", async ({ page }) => {
  await loginWithPhone(page, randomPhone(), "/competitions/tournoi-chesspirit-2026/inscription");
  await page.getByLabel("Prénom").fill("Sur");
  await page.getByLabel("Nom", { exact: true }).fill("Place");
  await page.getByLabel("Date de naissance").fill("2001-02-03");
  await page.getByLabel("Sexe").selectOption("M");
  await page.getByLabel("Ville").fill("Porto-Novo");
  await page.getByLabel("Département").selectOption("Ouémé");
  await page.getByLabel(/J'accepte les conditions générales/).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();

  await expect(page.getByText("À confirmer").first()).toBeVisible();
  await expect(page.getByLabel(/Payer maintenant/)).toHaveCount(0);
  await page.getByLabel(/J'accepte le/).check();
  await page.getByRole("button", { name: "Confirmer l'inscription" }).click();
  await expect(page.getByText("À régler sur place")).toBeVisible();
  await expect(page.locator("svg").filter({ has: page.locator("path") }).first()).toBeVisible();
});
