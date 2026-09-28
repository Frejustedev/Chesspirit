import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signature X-Hub-Signature-256 de Meta : HMAC-SHA256 du corps brut avec le secret de l'application. */
export function validSignature(raw: string, header: string | null, secret: string) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  return safeEqual(header.slice(7), expected);
}
