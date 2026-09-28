import "server-only";

/**
 * Lecture des feuilles de notation photographiées. Aucun service de reconnaissance n'est branché :
 * le mode « fake » (par défaut) renvoie une lecture simulée, clairement signalée, pour tester le
 * parcours de saisie. Un vrai fournisseur s'ajoute ici derrière la même interface (OCR_PROVIDER).
 */
export type ScoresheetReading = { moves: string; simulated: boolean };

const MAX_BYTES = 5 * 1024 * 1024;

/** Vérifie la signature du fichier (JPEG, PNG, WebP) plutôt que le type annoncé par le navigateur. */
export function imageKind(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "webp";
  return null;
}

export async function readScoresheet(file: File): Promise<ScoresheetReading> {
  if (file.size === 0 || file.size > MAX_BYTES) throw new Error("file_size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageKind(bytes)) throw new Error("file_type");
  const provider = process.env.OCR_PROVIDER ?? "fake";
  if (provider !== "fake") throw new Error("ocr_unavailable");
  // Lecture simulée : une ouverture courante, à corriger par l'arbitre comme une vraie lecture.
  return { moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7", simulated: true };
}
