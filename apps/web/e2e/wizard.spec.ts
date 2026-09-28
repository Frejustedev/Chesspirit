import { expect, test } from "@playwright/test";
import { loginAsAdmin, serviceDb } from "./helpers";

test("assistant de création, champ personnalisé, équipe, duplication", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await page.goto("/admin/tournois/nouveau");
  const slug = `e2e-assistant-${Date.now()}`;
  await page.getByLabel("Nom", { exact: true }).fill("Tournoi assistant E2E");
  await page.getByLabel(/Adresse \(slug\)/).fill(slug);
  await page.getByLabel("Date", { exact: true }).fill("2026-12-12");
  await page.getByLabel("Lieu").fill("Salle test");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Cadence", { exact: true }).selectOption("blitz");
  await page.getByLabel("Minutes").fill("3");
  await page.getByLabel("Incrément (s)").fill("2");
  await page.getByLabel("Nombre de rondes").fill("9");
  await page.getByRole("button", { name: "+ Confrontation directe" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel(/Frais d'inscription/).fill("1000");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Réservé à").selectOption("F");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByPlaceholder("Libellé").fill("Établissement");
  await page.getByRole("button", { name: "Créer le tournoi" }).click();
  await page.waitForURL(/onglet=reglages/);

  const db = serviceDb();
  const { data: t } = await db
    .from("tournaments")
    .select("id, cadence, tiebreaks, conditions, entry_fee_xof")
    .eq("slug", slug)
    .single();
  expect(t!.cadence).toBe("blitz");
  expect(t!.tiebreaks).toContain("direct_encounter");
  expect(t!.conditions).toMatchObject({ sex: "F" });
  expect(t!.entry_fee_xof).toBe(1000);
  const { data: form } = await db
    .from("registration_forms")
    .select("fields")
    .eq("tournament_id", t!.id)
    .single();
  expect(form!.fields).toEqual([expect.objectContaining({ key: "etablissement", type: "text" })]);

  await page.getByLabel("Téléphone ou e-mail").fill("+22990000005");
  await page.getByLabel("Rôle", { exact: true }).selectOption("chief_arbiter");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Arbitre Démo")).toBeVisible();

  await page.locator("#dup-date").fill("2027-12-11");
  await page.getByRole("button", { name: "Dupliquer" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith(t!.id));
  const { data: copy } = await db
    .from("tournaments")
    .select("status, duplicated_from")
    .eq("slug", `${slug}-${new Date().getFullYear() + 1}`)
    .single();
  expect(copy).toMatchObject({ status: "draft", duplicated_from: t!.id });
});
