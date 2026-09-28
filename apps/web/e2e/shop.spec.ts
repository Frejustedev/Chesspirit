import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("boutique : panier, code promo, paiement, suivi et expédition", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const db = serviceDb();
  // Stock garanti pour rejouer le test.
  const { data: variant } = await db
    .from("product_variants")
    .select("id, products!inner(slug)")
    .eq("products.slug", "pieces-staunton-demo")
    .single();
  await db.from("product_variants").update({ stock: 50 }).eq("id", variant!.id);

  await page.goto("/boutique/echiquiers");
  await page
    .getByRole("link", { name: /Pièces Staunton lestées/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Pièces Staunton lestées" })).toBeVisible();
  await page.getByLabel("Quantité").fill("2");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await expect(page).toHaveURL(/boutique\/panier/);
  await expect(page.getByRole("link", { name: "Pièces Staunton lestées" })).toBeVisible();
  await expect(page.getByText(/Sous-total\s*18\s000\s*FCFA/)).toBeVisible();
  await page.getByRole("link", { name: "Passer la commande" }).click();

  await loginWithPhone(page, "+22990000001", "/boutique/commande");
  await expect(page.getByRole("heading", { name: "Commande", exact: true })).toBeVisible();
  await page.getByLabel("Livraison à Cotonou").check();
  await page.getByLabel("Adresse de livraison").fill("Quartier Haie Vive, rue démo");
  await page.getByLabel("Code promo").fill("DEMO10");
  await page.getByRole("button", { name: "Appliquer" }).first().click();
  await expect(page.getByText("Remise (DEMO10)")).toBeVisible();
  // 18 000 − 1 800 + 1 500 de livraison
  await page.getByRole("button", { name: /Payer 17\s700/ }).click();
  await expect(page.getByRole("heading", { name: "Paiement simulé" })).toBeVisible();
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible();
  await page.getByRole("link", { name: "Voir ma commande" }).click();
  await page.waitForURL(/compte\/commandes\/CS-/);
  const number = page.url().match(/CS-\d{4}-\d+/)![0]!;
  await expect(page.getByText("Payée").first()).toBeVisible();

  // La boutique expédie la commande.
  const admin = await (await browser.newContext()).newPage();
  await loginAsAdmin(admin);
  await admin.goto("/admin/boutique");
  await admin.getByRole("link", { name: new RegExp(number) }).click();
  await admin.getByLabel("Nouvelle étape").selectOption("shipped");
  await admin.getByLabel("Note pour le client").fill("Livreur en route");
  await admin.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(admin.getByText(/Livreur en route/).first()).toBeVisible();

  // Suivi public avec numéro et téléphone.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/boutique/suivi");
  await visitor.getByLabel("Numéro de commande").fill(number);
  await visitor.getByLabel("Téléphone").fill("+229 90 00 00 01");
  await visitor.getByRole("button", { name: "Suivre" }).click();
  await expect(
    visitor.getByRole("heading", { name: new RegExp(`${number} · Expédiée`) }),
  ).toBeVisible();
});
