import { expect, test } from "@playwright/test";
import { loginAsAdmin, serviceDb } from "./helpers";

/** Recette « tournoi complet de bout en bout » : 8 joueurs, 3 rondes suisses, clôture, export TRF. */
test("tournoi suisse complet : génération, résultats, publication, direct, clôture, TRF", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const db = serviceDb();
  const slug = `e2e-suisse-${Date.now()}`;
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug,
      name: `Suisse E2E ${slug.slice(-5)}`,
      starts_at: new Date().toISOString(),
      status: "registration_open",
      rounds_count: 3,
      cadence: "rapid",
      is_demo: true,
    })
    .select("id")
    .single();
  const { data: players } = await db
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .eq("source", "demo")
    .not("birth_date", "is", null)
    .limit(8);
  const { data: ratings } = await db
    .from("ratings")
    .select("profile_id, rating")
    .eq("type", "rapid")
    .in(
      "profile_id",
      players!.map((p) => p.id),
    );
  const r = new Map((ratings ?? []).map((x) => [x.profile_id, x.rating]));
  await db.from("registrations").insert(
    players!.map((p) => ({
      tournament_id: t!.id,
      player_id: p.id,
      status: "confirmed",
      payment_status: "not_required",
      payment_method: "free",
      seed_rating: r.get(p.id) ?? null,
      checked_in_at: new Date().toISOString(),
      source: "admin",
    })),
  );

  await loginAsAdmin(page);
  await page.goto(`/admin/tournois/${t!.id}?onglet=rondes`);
  for (let round = 1; round <= 3; round++) {
    await page.getByRole("button", { name: `Générer la ronde ${round}` }).click();
    await expect(page.getByText(new RegExp(`Ronde ${round} générée`))).toBeVisible();
    // Le service Python (bbpPairings) doit avoir été utilisé en développement.
    await expect(page.getByRole("heading", { name: new RegExp(`Ronde ${round}`) })).toContainText(
      "bbpPairings",
    );
    const boards = page.getByRole("group", { name: /Résultat de l'échiquier/ });
    await expect(boards).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await boards
        .nth(i)
        .getByRole("button", { name: i % 3 === 1 ? "½–½" : "1–0" })
        .click();
      await expect(
        boards.nth(i).getByRole("button", { name: i % 3 === 1 ? "½–½" : "1–0" }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByRole("button", { name: "Retirer la publication" })).toBeVisible();
  }
  // Pas de 4e ronde au-delà du nombre prévu.
  await page.getByRole("button", { name: "Générer la ronde 4" }).click();
  await expect(page.getByText("Toutes les rondes ont été générées.")).toBeVisible();

  // Page publique en direct.
  await page.goto(`/competitions/${slug}/direct`);
  await expect(page.getByRole("link", { name: "R3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classement", exact: true })).toBeVisible();

  // Clôture et classement final.
  await page.goto(`/admin/tournois/${t!.id}?onglet=rondes`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clôturer le tournoi" }).click();
  await expect(page.getByText("Tournoi clôturé, classement final publié.")).toBeVisible();
  const { data: standings } = await db
    .from("standings")
    .select("rank, points, is_final")
    .eq("tournament_id", t!.id)
    .order("rank");
  expect(standings).toHaveLength(8);
  expect(standings!.every((s) => s.is_final)).toBe(true);
  expect(standings!.reduce((a, s) => a + Number(s.points), 0)).toBe(12); // 3 rondes × 4 parties

  // Aucun rematch sur les 3 rondes.
  const { data: pairings } = await db
    .from("pairings")
    .select("white_id, black_id")
    .eq("tournament_id", t!.id);
  const keys = pairings!.map((p) => [p.white_id, p.black_id].sort().join());
  expect(new Set(keys).size).toBe(keys.length);

  // Export TRF.
  const res = await page.request.get(`/api/admin/tournaments/${t!.id}/trf`);
  expect(res.status()).toBe(200);
  const trf = await res.text();
  expect(trf.split("\n").filter((l) => l.startsWith("001"))).toHaveLength(8);

  await page.goto(`/competitions/${slug}/resultats`);
  await expect(page.getByRole("row")).toHaveCount(9);
});
