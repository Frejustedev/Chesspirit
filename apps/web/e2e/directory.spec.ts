import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginWithPhone, serviceDb } from "./helpers";

test("annuaire : listes, carte, proposition, revendication et offre modérées", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  await page.goto("/annuaire");
  await expect(page.getByRole("heading", { level: 1, name: "Annuaire" })).toBeVisible();
  await page.goto("/annuaire/arbitres");
  await expect(page.getByText("Arbitre de club").first()).toBeVisible();
  await page.goto("/annuaire/carte");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("path.leaflet-interactive").first()).toBeVisible();

  // Un membre propose une structure et revendique le club de démonstration.
  const member = await (await browser.newContext()).newPage();
  await loginWithPhone(member, "+22990000001", "/annuaire/proposer");
  await member.waitForURL(/annuaire\/proposer/);
  await member.getByLabel("Nom", { exact: true }).fill(`Club E2E ${suffix}`);
  await member.getByLabel("Ville").fill("Parakou");
  await member.getByRole("button", { name: "Proposer" }).click();
  await expect(member.getByText("Merci ! Votre demande est transmise à l'équipe.")).toBeVisible();
  await db()
    .from("listing_claims")
    .delete()
    .eq("organization_id", (await clubId())!);
  await member.goto("/annuaire/structures/club-demo-cotonou");
  await member.getByLabel("Votre fonction dans la structure").fill("Secrétaire");
  await member.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(
    member.getByText(/Votre demande est en cours d'examen|Merci ! Votre demande/),
  ).toBeVisible();
  await member.goto("/annuaire/emplois/publier");
  await member.getByLabel("Intitulé").fill(`Arbitre pour open ${suffix}`);
  await member
    .getByLabel("Présentation")
    .fill("Nous cherchons un arbitre pour un open rapide d'une journée.");
  await member.getByLabel("Contact").fill("+229 90 00 00 01");
  await member.getByRole("button", { name: "Publier une offre" }).click();
  await expect(member.getByText("Merci ! Votre demande est transmise à l'équipe.")).toBeVisible();

  // Modération.
  await loginAsAdmin(page);
  await page.goto("/admin/annuaire");
  const org = page.locator("li", { hasText: `Club E2E ${suffix}` });
  await org.getByRole("button", { name: "Publier" }).click();
  await expect(org.getByText(/publique/)).toBeVisible();
  const claim = page.locator("li", { hasText: "Secrétaire" });
  await claim.getByRole("button", { name: "Accepter" }).click();
  await expect(page.locator("li", { hasText: "Secrétaire" })).toHaveCount(0);
  const job = page.locator("li", { hasText: `Arbitre pour open ${suffix}` });
  await job.getByRole("button", { name: "Publier" }).click();
  await expect(job.getByText(/publiée/)).toBeVisible();

  await page.goto("/annuaire/emplois");
  await expect(page.getByRole("heading", { name: `Arbitre pour open ${suffix}` })).toBeVisible();
  await page.goto(`/annuaire/clubs?q=${suffix}`);
  await expect(page.getByText(`Club E2E ${suffix}`)).toBeVisible();

  // Remise en état : le club de démonstration redevient non revendiqué.
  await db()
    .from("organizations")
    .update({ claimed_by: null, verified: false })
    .eq("slug", "club-demo-cotonou");
});

const db = () => serviceDb();
async function clubId() {
  const { data } = await db()
    .from("organizations")
    .select("id")
    .eq("slug", "club-demo-cotonou")
    .single();
  return data?.id as string | undefined;
}
