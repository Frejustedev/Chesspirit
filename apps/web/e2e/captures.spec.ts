import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

/** Captures des pages clés en mobile (390 px) et ordinateur (1440 px) → docs/captures/. */
const OUT = path.resolve(import.meta.dirname, "../../../docs/captures");
const WIDTHS = [390, 1440] as const;

async function shoot(page: Page, name: string, url: string) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    // Aucun défilement horizontal à 390 px comme à 1440 px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  }
}

test("pages publiques", async ({ page }) => {
  test.setTimeout(400_000);
  const { data: g } = await serviceDb().from("games").select("id").limit(1).single();
  await shoot(page, "01-accueil", "/");
  await shoot(page, "02-calendrier", "/competitions");
  await shoot(page, "03-tournoi-3-octobre", "/competitions/tournoi-chesspirit-2026");
  await shoot(page, "04-resultats", "/competitions/open-demo-cotonou/resultats");
  await shoot(page, "05-partie", `/parties/${g!.id}`);
  await shoot(page, "06-connexion", "/connexion");
  await shoot(page, "07-reglement", "/legal/reglement-tournois");
  await shoot(page, "08-en-preparation", "/media");
  await shoot(page, "12-coaching", "/coaching");
  await shoot(page, "13-boutique", "/boutique");
  await shoot(page, "14-produit", "/boutique/produit/echiquier-bois-demo");
  await shoot(page, "15-ligues", "/competitions/ligues?saison=saison-demo");
  await shoot(page, "16-ligue", "/competitions/ligues/saison-demo-l1-classique");
  await shoot(page, "17-tour", "/classements/tour?saison=saison-demo");
  await shoot(page, "18-annuaire", "/annuaire");
  await shoot(page, "19-carte", "/annuaire/carte");
});

test("média et académie", async ({ page }) => {
  test.setTimeout(180_000);
  await shoot(page, "30-media", "/media");
  await shoot(page, "31-episode", "/media/episodes/coup-de-la-semaine-demo-1");
  await shoot(page, "32-academie", "/academie");
  await shoot(page, "33-puzzle-du-jour", "/academie/puzzle-du-jour");
  await shoot(page, "34-lexique", "/academie/lexique");
});

test("espace joueur", async ({ page }) => {
  await loginWithPhone(page, "+22990000001", "/compte");
  await page.waitForURL(/compte/);
  await shoot(page, "10-compte", "/compte");
  await shoot(page, "11-inscription", "/competitions/tournoi-chesspirit-2026/inscription");
});

test("administration", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsAdmin(page);
  const { data: t } = await serviceDb()
    .from("tournaments")
    .select("id")
    .eq("slug", "tournoi-chesspirit-2026")
    .single();
  await shoot(page, "20-admin", "/admin");
  await shoot(page, "21-admin-inscrits", `/admin/tournois/${t!.id}`);
  await shoot(page, "22-admin-pointage", `/admin/tournois/${t!.id}?onglet=pointage`);
  await shoot(page, "23-admin-reglages", `/admin/tournois/${t!.id}?onglet=reglages`);
  await shoot(page, "24-admin-boutique", "/admin/boutique?filtre=all");
  await shoot(page, "25-admin-statistiques", "/admin/statistiques");
  await shoot(page, "26-admin-ligues", "/admin/ligues?saison=saison-demo");
});
