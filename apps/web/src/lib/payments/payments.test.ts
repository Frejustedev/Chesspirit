import { describe, expect, it } from "vitest";
import { fakeProvider, signFake } from "./fake";
import { fedapayProvider } from "./fedapay";
import { kkiapayProvider } from "./kkiapay";
import { hmacHex } from "./crypto";

describe("fournisseur factice", () => {
  const p = fakeProvider("secret");
  it("accepte une signature valide", async () => {
    const body = JSON.stringify({ payment_id: "abc", status: "succeeded" });
    const evt = await p.verifyWebhook(body, new Headers({ "x-fake-signature": signFake("secret", body) }));
    expect(evt).toMatchObject({ paymentId: "abc", status: "succeeded" });
  });
  it("refuse une signature falsifiée ou périmée", async () => {
    const body = JSON.stringify({ payment_id: "abc", status: "succeeded" });
    expect(await p.verifyWebhook(body, new Headers({ "x-fake-signature": signFake("autre", body) }))).toBeNull();
    expect(await p.verifyWebhook(body, new Headers({ "x-fake-signature": signFake("secret", body, 1000) }))).toBeNull();
    expect(await p.verifyWebhook(body, new Headers())).toBeNull();
  });
});

describe("FedaPay", () => {
  const p = fedapayProvider({ secretKey: "sk", webhookSecret: "wh", env: "sandbox" });
  it("vérifie la signature et traduit le statut", async () => {
    const body = JSON.stringify({ name: "transaction.approved", entity: { id: 42, status: "approved", custom_metadata: { payment_id: "p1" } } });
    const t = Math.floor(Date.now() / 1000);
    const evt = await p.verifyWebhook(body, new Headers({ "x-fedapay-signature": `t=${t},s=${hmacHex("wh", `${t}.${body}`)}` }));
    expect(evt).toMatchObject({ providerRef: "42", paymentId: "p1", status: "succeeded" });
    expect(await p.verifyWebhook(body, new Headers({ "x-fedapay-signature": `t=${t},s=deadbeef` }))).toBeNull();
  });
});

describe("KKiaPay", () => {
  it("refuse un secret invalide sans appeler l'API", async () => {
    const p = kkiapayProvider({ publicKey: "a", privateKey: "b", secret: "c", sandbox: true });
    expect(await p.verifyWebhook("{}", new Headers({ "x-kkiapay-secret": "x" }))).toBeNull();
  });
});
