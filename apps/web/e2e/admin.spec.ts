import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("un compte sans rôle n'accède pas à l'administration", async ({ page }) => {
  await loginWithPhone(page, "+22990000001", "/admin");
  await expect(page).toHaveURL(/\/compte/);
});

test("administrateur : 2FA, inscrits, export CSV, pointage, import des résultats, réglages", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();

  // Tournoi dédié au test (isolation), inscription préparée côté service pour le pointage.
  const db = serviceDb();
  const slug = `e2e-admin-${Date.now()}`;
  const { data: t } = await db
    .from("tournaments")
    .insert({ slug, name: `Tournoi E2E ${slug}`, starts_at: new Date(Date.now() + 7 * 86400000).toISOString(), status: "registration_open", entry_fee_xof: 1500, is_demo: true })
    .select("id")
    .single();
  await page.goto(`/admin/tournois/${t!.id}`);
  const { data: p } = await db.from("profiles").select("id").eq("is_demo", true).eq("is_public", true).limit(1).single();
  await db.from("registrations").upsert(
    { tournament_id: t!.id, player_id: p!.id, status: "confirmed", payment_status: "due_on_site", payment_method: "on_site", amount_xof: 1500, source: "admin" },
    { onConflict: "tournament_id,player_id" },
  );
  const { data: reg } = await db.from("registrations").select("ticket_code").eq("tournament_id", t!.id).eq("player_id", p!.id).single();
  await db.from("registrations").update({ checked_in_at: null, payment_status: "due_on_site" }).eq("ticket_code", reg!.ticket_code);

  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Téléphone" })).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exporter en CSV" }).click();
  expect((await csv).suggestedFilename()).toBe(`inscrits-${slug}.csv`);

  await page.getByRole("link", { name: "Pointage" }).click();
  await page.getByLabel("Code du billet").fill(reg!.ticket_code);
  await page.getByRole("button", { name: "Pointer" }).click();
  await expect(page.getByText(/pointé · Payé/)).toBeVisible();
  await page.getByLabel("Code du billet").fill("FFFFFFFFFFFF");
  await page.getByRole("button", { name: "Pointer" }).click();
  await expect(page.getByText("Billet introuvable.")).toBeVisible();

  await page.getByRole("link", { name: "Résultats et parties" }).click();
  await page.getByLabel("Ou collez le tableau").fill("rang;nom;points;club\n1;Joueur Import Un;8;Club test\n2;Joueur Import Deux;7;");
  await expect(page.getByText("Aperçu : 2 lignes")).toBeVisible();
  await page.getByRole("button", { name: "Importer et publier le classement" }).click();
  await expect(page.getByText("2 lignes importées.")).toBeVisible();
  await page.goto(`/competitions/${slug}/resultats`);
  await expect(page.getByRole("cell", { name: "Joueur Import Un" })).toBeVisible();

  // Réglages : l'administrateur renseigne un champ « À confirmer ».
  await page.goto(`/admin/tournois/${t!.id}?onglet=reglages`);
  await page.getByLabel("Nombre de rondes").fill("7");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  const { data: after } = await db.from("tournaments").select("rounds_count").eq("id", t!.id).single();
  expect(after!.rounds_count).toBe(7);

  // Journal d'audit : les consultations et modifications sont tracées.
  const { count } = await db.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "view_personal_data");
  expect(count).toBeGreaterThan(0);
});
