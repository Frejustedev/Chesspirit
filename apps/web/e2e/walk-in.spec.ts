import { expect, test } from "@playwright/test";
import { loginAsAdmin, serviceDb } from "./helpers";

test("jour J : joueur ajouté sur place et pointé, pointage depuis la liste", async ({ page }) => {
  await loginAsAdmin(page);
  const db = serviceDb();
  const slug = `e2e-sur-place-${Date.now()}`;
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug,
      name: `Tournoi E2E ${slug}`,
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      status: "registration_open",
      entry_fee_xof: 0,
      is_demo: true,
    })
    .select("id")
    .single();
  await page.goto(`/admin/tournois/${t!.id}`);

  const suffix = String(Date.now()).slice(-6);
  // Joueur présent : inscrit et pointé d'un coup (téléphone béninois sans indicatif).
  await page.getByLabel("Prénom").fill("Awa");
  await page.getByLabel("Nom", { exact: true }).fill(`SurPlace${suffix}`);
  await page.getByLabel(/Téléphone/).fill(`97${suffix}`);
  await page.getByRole("button", { name: "Ajouter le joueur" }).click();
  await expect(page.getByRole("status")).toContainText(`Awa SurPlace${suffix} est inscrit.`);
  const row1 = page.getByRole("row", { name: new RegExp(`SurPlace${suffix}`) });
  await expect(row1).toContainText("✓");
  await expect(row1).toContainText(`+22997${suffix}`);

  // Second joueur non pointé, puis pointé depuis la liste.
  await page.getByLabel("Prénom").fill("Koffi");
  await page.getByLabel("Nom", { exact: true }).fill(`Retard${suffix}`);
  await page.getByLabel(/Pointer tout de suite/).uncheck();
  await page.getByRole("button", { name: "Ajouter le joueur" }).click();
  const row2 = page.getByRole("row", { name: new RegExp(`Retard${suffix}`) });
  await expect(row2).toBeVisible();
  await expect(row2).not.toContainText("✓");
  await row2.getByRole("button", { name: "Pointer" }).click();
  await expect(row2).toContainText("✓");
  await expect(page.getByText(/2 inscrits · 2 pointés/)).toBeVisible();
});
