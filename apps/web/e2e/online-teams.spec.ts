import { expect, test, type Browser } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

async function linkLichess(browser: Browser, phone: string, username: string) {
  const page = await (await browser.newContext()).newPage();
  await loginWithPhone(page, phone, "/compte/profil");
  await page.waitForURL(/compte\/profil/);
  const unlink = page.getByRole("button", { name: "Délier" });
  if (await unlink.isVisible()) {
    await unlink.click();
    await expect(page.getByRole("button", { name: "Lier (mode test)" })).toBeVisible();
  }
  await page.getByLabel("Nom d'utilisateur Lichess").fill(username);
  await page.getByRole("button", { name: "Lier (mode test)" }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  const { data } = await serviceDb().from("profiles").select("id").eq("phone", phone).single();
  await page.context().close();
  return data!.id as string;
}

test("en ligne : liaison Lichess, import des résultats, cote en ligne", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const a = await linkLichess(browser, "+22990000001", `grace_${suffix}`);
  const b = await linkLichess(browser, "+22990000003", `coach_${suffix}`);
  const db = serviceDb();
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-en-ligne-${suffix}`,
      name: `Arena en ligne ${suffix}`,
      starts_at: new Date(Date.now() - 86400000).toISOString(),
      cadence: "blitz",
      base_minutes: 3,
      increment_seconds: 2,
      is_online: true,
      rated: true,
      status: "ongoing",
      pairing_system: "arena",
    })
    .select("id")
    .single();
  await db.from("registrations").insert(
    [a, b].map((p) => ({
      tournament_id: t!.id,
      player_id: p,
      status: "confirmed",
      payment_status: "not_required",
      source: "admin",
    })),
  );

  await loginAsAdmin(page);
  await page.goto(`/admin/tournois/${t!.id}?onglet=en-ligne`);
  await expect(page.getByText(`grace_${suffix}`)).toBeVisible();
  await page
    .getByLabel("Identifiant ou lien Lichess")
    .fill("https://lichess.org/tournament/Abcd1234");
  await page.getByRole("button", { name: "Lier", exact: true }).click();
  await expect(page.getByText("Tournoi Lichess lié.")).toBeVisible();
  await page.getByRole("button", { name: "Importer les résultats" }).click();
  await expect(page.getByText(/2 joueurs classés, 1 parties importées/)).toBeVisible();

  // Clôture : la partie compte pour la cote en ligne, pas pour la cote en présentiel.
  await page.goto(`/admin/tournois/${t!.id}?onglet=rondes`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clôturer le tournoi" }).click();
  // La clôture recalcule toutes les cotes (rejeu des parties homologuées) : quelques secondes.
  await expect(page.getByText(/clôturé/i).first()).toBeVisible({ timeout: 30_000 });
  const { data: online } = await db
    .from("rating_history")
    .select("type")
    .eq("tournament_id", t!.id);
  expect(online?.length).toBe(2);
  expect(online?.every((r) => r.type === "online")).toBe(true);

  // Nettoyage : parties et tournoi de test supprimés (les autres parcours comptent les parties du joueur).
  await db.from("games").delete().eq("tournament_id", t!.id);
  await db.from("rating_history").delete().eq("tournament_id", t!.id);
  await db.from("tournaments").delete().eq("id", t!.id);
});

test("équipes : compositions, appariement, résultats par échiquier, classement public", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const db = serviceDb();
  const { data: players } = await db
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("is_demo", true)
    .is("user_id", null)
    .order("id")
    .limit(8);
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-equipes-${suffix}`,
      name: `Interclubs ${suffix}`,
      starts_at: new Date().toISOString(),
      cadence: "rapid",
      rounds_count: 3,
      pairing_system: "team_swiss",
      status: "ongoing",
    })
    .select("id, slug")
    .single();
  await db.from("registrations").insert(
    players!.map((p, i) => ({
      tournament_id: t!.id,
      player_id: p.id,
      status: "confirmed",
      payment_status: "not_required",
      seed_rating: 2000 - i * 20,
      source: "admin",
    })),
  );

  await loginAsAdmin(page);
  await page.goto(`/admin/tournois/${t!.id}?onglet=equipes`);
  for (const [i, name] of ["Les Fous de Cotonou", "Tours de Porto-Novo"].entries()) {
    await page.getByPlaceholder("Nom de l'équipe").fill(name);
    await page.getByRole("button", { name: "Ajouter l'équipe" }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    const card = page.locator("li", { hasText: name }).first();
    for (let k = 0; k < 4; k++) {
      const p = players![i * 4 + k]!;
      await card.getByLabel("Joueur").selectOption({ label: `${p.first_name} ${p.last_name}` });
      await card.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(card.getByText(`${p.first_name} ${p.last_name}`)).toBeVisible();
    }
  }
  await page.getByRole("button", { name: "Apparier la ronde suivante" }).click();
  await expect(page.getByRole("heading", { name: "Ronde 1" })).toBeVisible();
  for (let n = 1; n <= 4; n++) {
    await page.getByLabel(`Résultat de l'échiquier ${n}`).selectOption(n % 2 ? "1-0" : "1/2-1/2");
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Dépublier" })).toBeVisible();

  await page.goto(`/competitions/${t!.slug}/equipes`);
  await expect(page.getByRole("heading", { name: "Équipes et rencontres" })).toBeVisible();
  // Domicile : Blancs aux échiquiers 1 et 3 (gagnés), nulles aux 2 et 4 → 3 – 1.
  const first = page.locator("tbody tr").first();
  await expect(first).toContainText("2");
  await expect(first).toContainText("3");
});
