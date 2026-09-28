import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validSignature } from "./whatsapp-signature";

describe("signature WhatsApp", () => {
  const body = '{"entry":[]}';
  const sig = `sha256=${createHmac("sha256", "secret-test").update(body).digest("hex")}`;
  it("accepte la bonne signature", () => {
    expect(validSignature(body, sig, "secret-test")).toBe(true);
  });
  it("refuse une signature absente, fausse ou d'un autre corps", () => {
    expect(validSignature(body, null, "secret-test")).toBe(false);
    expect(validSignature(body, "sha256=00", "secret-test")).toBe(false);
    expect(validSignature(`${body} `, sig, "secret-test")).toBe(false);
    expect(validSignature(body, sig, "autre")).toBe(false);
    expect(validSignature(body, sig, "")).toBe(false);
  });
});
