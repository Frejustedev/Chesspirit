import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

const PHONE = "+22990000001";

async function memberId() {
  const { data } = await serviceDb().from("profiles").select("id").eq("phone", PHONE).single();
  return data!.id;
}

test("adhésion gratuite puis premium : carte de membre et leçon premium débloquée", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = serviceDb();
  const me = await memberId();
  await db.from("memberships").delete().eq("profile_id", me);
  await db.from("membership_plans").update({ price_xof: 5000 }).eq("code", "premium");
  try {
    await loginWithPhone(page, PHONE, "/communaute/adhesion");
    await page.waitForURL(/communaute\/adhesion/);
    await page.getByRole("button", { name: "Adhérer gratuitement" }).click();
    await expect(page.getByText(/CSP-\d{6}/)).toBeVisible();
    const card = (await page.getByText(/CSP-\d{6}/).textContent())!.match(/CSP-\d{6}/)![0];

    await page.goto("/academie/lecons/finale-de-lucena");
    await expect(page.getByText("Cette leçon fait partie des cours premium.")).toBeVisible();

    await page.goto("/communaute/adhesion");
    await page.getByRole("button", { name: "Devenir membre premium" }).click();
    await expect(page.getByRole("heading", { name: "Paiement simulé" })).toBeVisible();
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page.getByRole("heading", { name: "Paiement confirmé" })).toBeVisible();

    await page.goto("/academie/lecons/finale-de-lucena");
    await expect(page.getByRole("heading", { name: "La méthode" })).toBeVisible();
    await page.goto("/academie/premium");
    await expect(page.getByText("Vous êtes membre premium")).toBeVisible();
    await page.goto("/communaute/badges");
    await expect(page.getByText("Mon niveau")).toBeVisible();

    await page.goto(`/membre/${card}`);
    await expect(page.getByText("Carte de membre valide")).toBeVisible();
    await page.goto("/membre/CSP-999999");
    await expect(page.getByText("Carte inconnue ou expirée")).toBeVisible();
  } finally {
    await db.from("membership_plans").update({ price_xof: null }).eq("code", "premium");
    await db.from("memberships").delete().eq("profile_id", me);
    await db
      .from("user_badges")
      .delete()
      .eq("profile_id", me)
      .in("badge_code", ["member", "premium"]);
  }
});

test("parrainage, ambassadeur, Awards et le public contre le maître", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(180_000);
  const db = serviceDb();
  const me = await memberId();
  const suffix = Date.now().toString(36);
  const { data: referrer } = await db
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .is("user_id", null)
    .limit(1)
    .single();
  await db.from("referrals").delete().eq("referred_id", me);
  await db.from("ambassadors").delete().eq("profile_id", me);
  await db.from("referral_codes").delete().eq("code", "E2EPARRAIN");
  await db.from("referral_codes").upsert({ profile_id: referrer!.id, code: "E2EPARRAIN" });
  const { data: game } = await db
    .from("pvm_games")
    .insert({
      slug: `pvm-e2e-${suffix}`,
      title: { fr: `Partie e2e ${suffix}`, en: `E2E game ${suffix}` },
      master_name: "Maître e2e",
      public_color: "w",
    })
    .select("id")
    .single();

  try {
    // Lien de parrainage : le code est mémorisé dans un cookie jusqu'à la création du profil.
    await page.goto("/?parrain=e2eparrain");
    expect((await context.cookies()).find((c) => c.name === "cs_parrain")?.value).toBe(
      "E2EPARRAIN",
    );

    await loginWithPhone(page, PHONE, "/communaute/ambassadeurs");
    await page.waitForURL(/communaute\/ambassadeurs/);
    await expect(page.getByText("Votre lien de parrainage")).toBeVisible();
    await page.getByLabel("Code de parrainage").fill("E2EPARRAIN");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText("Parrainage enregistré. Bienvenue !")).toBeVisible();

    await page.getByLabel("Ville").fill("Parakou");
    await page
      .getByLabel(/Votre motivation/)
      .fill("Je veux faire découvrir les échecs aux jeunes de Parakou.");
    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
    await expect(page.getByText("Candidature en cours d'examen.")).toBeVisible();

    await page.goto("/communaute/awards");
    await expect(page.getByText("Édition de démonstration")).toBeVisible();
    await page.getByRole("button", { name: "Voter : Joueuse démo B" }).click();
    await expect(page.getByText("Votre vote").first()).toBeVisible();

    await page.goto(`/communaute/public-contre-le-maitre/pvm-e2e-${suffix}`);
    await expect(page.getByText("Au public de jouer")).toBeVisible();
    await page.getByRole("button", { name: /^e2, / }).click();
    await page.getByRole("button", { name: /^e4$/ }).click();
    await expect(page.getByText("Vote enregistré.")).toBeVisible();
    await expect(page.getByText("e2e4")).toBeVisible();

    // L'administration approuve l'ambassadeur, joue le coup du public puis celui du maître.
    const admin = await (await browser.newContext()).newPage();
    await loginAsAdmin(admin);
    await admin.goto("/admin/communaute?onglet=ambassadeurs");
    const row = admin.locator("li", { hasText: "Je veux faire découvrir les échecs" });
    await row.getByRole("button", { name: "Approuver" }).click();
    await expect(row.getByText("approuvé")).toBeVisible();

    await admin.goto(`/communaute/public-contre-le-maitre/pvm-e2e-${suffix}`);
    await admin.getByRole("button", { name: "Jouer le coup le plus voté" }).click();
    await expect(admin.getByText("Au maître de jouer.")).toBeVisible();
    await admin.getByLabel("Coup du maître (ex. e7e5)").fill("e7e6");
    await admin.getByRole("button", { name: "Jouer", exact: true }).click();
    await expect(admin.getByText("1. e4 e6")).toBeVisible();

    await page.goto("/communaute/ambassadeurs");
    await expect(page.getByText("Vous êtes ambassadeur Chesspirit.")).toBeVisible();
  } finally {
    await db.from("pvm_games").delete().eq("id", game!.id);
    await db.from("referrals").delete().eq("referred_id", me);
    await db.from("ambassadors").delete().eq("profile_id", me);
    await db.from("user_badges").delete().eq("profile_id", me).eq("badge_code", "ambassador");
    await db.from("award_votes").delete().eq("voter_id", me);
  }
});
