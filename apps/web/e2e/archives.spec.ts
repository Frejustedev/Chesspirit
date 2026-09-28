import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAsAdmin, serviceDb } from "./helpers";

/** Secrets locaux générés par scripts/dev.mjs (jamais versionnés). */
function localEnv(key: string) {
  const file = fs.readFileSync(path.resolve(import.meta.dirname, "../.env.local"), "utf8");
  return file.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

// Plus petite image PNG valide (1 × 1 pixel).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("archives : recherche de parties et explorateur de positions", async ({ page }) => {
  const { data: g } = await serviceDb().from("games").select("white_name").limit(1).single();
  const surname = g!.white_name.split(" ").at(-1)!;
  await page.goto(`/competitions/archives?joueur=${encodeURIComponent(surname)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Archives" })).toBeVisible();
  await expect(page.getByText(/\d+ parties?/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(surname) }).first()).toBeVisible();

  await page.goto("/competitions/archives/position");
  await expect(page.getByRole("heading", { name: "Coups joués ensuite" })).toBeVisible();
  const first = page.locator("table a").first();
  const san = (await first.textContent())!.trim();
  await first.click();
  await page.waitForURL(new RegExp(`coups=${encodeURIComponent(san).replace(/[+]/g, "\\+")}`));
  await expect(page.getByLabel("Suite de coups")).toContainText(san);
  await page.getByRole("button", { name: "Position de départ" }).click();
  await page.waitForURL(/archives\/position$/);
});

test("feuille de notation : lecture simulée, relecture et enregistrement", async ({ page }) => {
  test.setTimeout(150_000);
  const db = serviceDb();
  const suffix = Date.now().toString(36);
  await db.from("feature_flags").update({ enabled: true }).eq("key", "scoresheet_ocr");
  const { data: players } = await db
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .is("user_id", null)
    .eq("is_public", true)
    .limit(2);
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-feuilles-${suffix}`,
      name: `Feuilles ${suffix}`,
      starts_at: new Date().toISOString(),
      status: "ongoing",
      rounds_count: 1,
    })
    .select("id")
    .single();
  const { data: round } = await db
    .from("rounds")
    .insert({
      tournament_id: t!.id,
      number: 1,
      status: "ongoing",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  await db.from("pairings").insert({
    tournament_id: t!.id,
    round_id: round!.id,
    board: 1,
    white_id: players![0]!.id,
    black_id: players![1]!.id,
    result: "1-0",
  });
  try {
    await loginAsAdmin(page);
    await page.goto(`/admin/tournois/${t!.id}?onglet=feuilles`);
    await page
      .getByLabel("Photo de la feuille")
      .setInputFiles({ name: "feuille.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Lire la feuille" }).click();
    await expect(page.getByText(/Mode test : lecture simulée/)).toBeVisible();
    const moves = page.getByLabel("Coups (notation algébrique)");
    await expect(moves).toHaveValue(/1\. e4 e5/);
    await moves.fill("1. e4 e5 2. Nf3 Nc6 3. Bb9");
    await expect(page.getByText("Coup 5 illégal : « Bb9 »", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer la partie" })).toBeDisabled();
    await moves.fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6");
    await expect(page.getByText("Tous les coups sont légaux.")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer la partie" }).click();
    await expect(page.getByText("Partie enregistrée.")).toBeVisible();
    const { data: game } = await db
      .from("games")
      .select("id, source, result, positions_indexed_at")
      .eq("tournament_id", t!.id)
      .single();
    expect(game?.source).toBe("ocr");
    expect(game?.result).toBe("1-0");
    expect(game?.positions_indexed_at).not.toBeNull();
    const { count } = await db
      .from("game_positions")
      .select("ply", { count: "exact", head: true })
      .eq("game_id", game!.id);
    expect(count).toBe(7);
  } finally {
    await db.from("feature_flags").update({ enabled: false }).eq("key", "scoresheet_ocr");
    await db.from("games").delete().eq("tournament_id", t!.id);
    await db.from("tournaments").delete().eq("id", t!.id);
  }
});

test("assistant WhatsApp : vérification, signature, réponse et déduplication", async ({
  request,
}) => {
  const db = serviceDb();
  const verify = localEnv("WHATSAPP_VERIFY_TOKEN");
  const secret = localEnv("WHATSAPP_APP_SECRET");
  expect(verify && secret).toBeTruthy();

  const ok = await request.get(
    `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verify}&hub.challenge=12345`,
  );
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("12345");
  expect(
    (
      await request.get(
        "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=1",
      )
    ).status(),
  ).toBe(403);

  const id = `wamid.e2e-${Date.now()}`;
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id,
                  from: "22990000077",
                  type: "text",
                  text: { body: "Quel est le prochain tournoi ?" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const sign = (b: string) => `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`;
  const post = (b: string, sig?: string) =>
    request.post("/api/webhooks/whatsapp", {
      data: b,
      headers: {
        "content-type": "application/json",
        ...(sig ? { "x-hub-signature-256": sig } : {}),
      },
    });
  expect((await post(body)).status()).toBe(401);
  expect((await post(body, sign(`${body} `))).status()).toBe(401);

  await db.from("feature_flags").update({ enabled: true }).eq("key", "whatsapp_assistant");
  try {
    const r = await post(body, sign(body));
    expect(r.status()).toBe(200);
    expect((await r.json()).replied).toBe(1);
    const again = await post(body, sign(body));
    expect((await again.json()).replied).toBe(0);
    const { data: n } = await db
      .from("notifications")
      .select("channel, template, payload, status")
      .eq("recipient", "+22990000077")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(n?.channel).toBe("whatsapp");
    expect(n?.template).toBe("assistant_next_tournament");
    expect(n?.status).toBe("skipped");
    expect(JSON.stringify(n?.payload)).toContain("tournoi");
  } finally {
    await db.from("feature_flags").update({ enabled: false }).eq("key", "whatsapp_assistant");
    await db.from("whatsapp_inbound").delete().eq("wa_from", "22990000077");
    await db.from("notifications").delete().eq("recipient", "+22990000077");
  }
});

test("import de participants depuis un fichier CSV", async ({ page }) => {
  const db = serviceDb();
  const suffix = Date.now().toString(36);
  const { data: t } = await db
    .from("tournaments")
    .insert({
      slug: `e2e-import-${suffix}`,
      name: `Import ${suffix}`,
      starts_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      status: "registration_open",
      entry_fee_xof: 1000,
    })
    .select("id")
    .single();
  const csv = `prénom;nom;naissance;sexe;téléphone;paiement\nAya${suffix};Importée;2004-05-06;F;;payé\n;SansPrénom;;;;\n`;
  try {
    await loginAsAdmin(page);
    await page.goto(`/admin/tournois/${t!.id}?onglet=inscrits`);
    await page.getByText("Importer des participants (CSV)").click();
    await page
      .getByLabel("Fichier CSV")
      .setInputFiles({ name: "inscrits.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("2 lignes prêtes")).toBeVisible();
    await page.getByRole("button", { name: "Importer", exact: true }).click();
    await expect(
      page.getByText(/1 inscrit\(s\), 0 déjà inscrit\(s\) ; 1 profil\(s\) créé\(s\)/),
    ).toBeVisible();
    await expect(page.getByText("Ligne 3 : prénom et nom obligatoires")).toBeVisible();
    await expect(page.getByText(`Aya${suffix}`).first()).toBeVisible();
  } finally {
    const { data: regs } = await db
      .from("registrations")
      .select("player_id")
      .eq("tournament_id", t!.id);
    await db.from("tournaments").delete().eq("id", t!.id);
    for (const r of regs ?? [])
      await db.from("profiles").delete().eq("id", r.player_id).eq("source", "import");
  }
});
