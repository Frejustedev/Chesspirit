/** SecureStore limite chaque valeur à 2 048 octets : la session est découpée en morceaux. */
export const CHUNK = 1800;

export function split(value: string, size = CHUNK): string[] {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out.length ? out : [""];
}

/** Clé SecureStore autorisée : lettres, chiffres, « . », « - » et « _ ». */
export function safeKey(key: string) {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}
