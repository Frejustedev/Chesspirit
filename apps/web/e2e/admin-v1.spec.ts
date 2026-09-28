import { expect, test } from "@playwright/test";
import { loginAsAdmin, randomPhone, serviceDb } from "./helpers";

test("administration : utilisateurs, suspension, doublons, paiements, messages, réglages", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = serviceDb();
  const phone = randomPhone();
  const { data: created } = await db.auth.admin.createUser({ phone, phone_confirm: true });
  const last = `E2e${Date.now().toString(36)}`;
  const { data: prof } = await db
    .from("profiles")
    .insert({
      user_id: created.user!.id,
      first_name: "Awa",
      last_name: last,
      phone,
      onboarded: true,
    })
    .select("id")
    .single();
  await db.from("profiles").insert({ first_name: "Awa", last_name: last, source: "import" });

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Utilisateurs" }).first().click();
  await page.getByLabel("Nom, ville, club ou téléphone").fill(last);
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByText("2 personnes")).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`Awa ${last}.*compte`) }).click();
  await expect(page.getByRole("heading", { name: `Awa ${last}` })).toBeVisible();

  // Suspension : le compte de connexion est bloqué.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Suspendre le compte" }).click();
  await expect(page.getByText(/Suspendu depuis le/)).toBeVisible();
  const { data: banned } = await db.auth.admin.getUserById(created.user!.id);
  expect(banned.user?.banned_until).toBeTruthy();
  await page.getByRole("button", { name: "Réactiver le compte" }).click();
  await expect(page.getByText(/Suspendu depuis le/)).toHaveCount(0);

  // Fusion du doublon importé.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Fusionner ici" }).click();
  await expect(page.getByText("Aucun doublon probable.")).toBeVisible();
  const { data: merged } = await db
    .from("profiles")
    .select("id")
    .eq("last_name", last)
    .eq("merged_into", prof!.id);
  expect(merged?.length).toBe(1);

  await page.goto("/admin/paiements");
  await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
  const csv = await page.request.get("/api/admin/payments");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("amount_xof");

  await page.goto("/admin/messages?onglet=donnees");
  await expect(page.getByRole("heading", { name: "Messages et demandes" })).toBeVisible();
  await page.goto("/admin/reglages");
  await expect(page.getByLabel("shop_shipping_cotonou_xof")).toBeVisible();
  await page.goto("/admin/journal");
  await expect(page.getByText("merge_profiles").first()).toBeVisible();

  // Non-administrateur : export refusé.
  const anon = await page.context().browser()!.newContext();
  const res = await anon.request.get("http://localhost:3000/api/admin/payments");
  expect(res.status()).toBe(403);
});
