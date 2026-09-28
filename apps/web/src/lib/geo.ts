/** Coordonnées approximatives des principales villes du Bénin (centre-ville), pour la carte. */
export const BENIN_CITIES: Record<string, [number, number]> = {
  cotonou: [6.3654, 2.4183],
  "porto-novo": [6.4969, 2.6289],
  "abomey-calavi": [6.4485, 2.3557],
  bohicon: [7.1782, 2.0667],
  abomey: [7.1829, 1.9912],
  parakou: [9.3372, 2.6303],
  natitingou: [10.3042, 1.3796],
  djougou: [9.7085, 1.666],
  lokossa: [6.6387, 1.7167],
  ouidah: [6.3631, 2.0851],
  kandi: [11.1342, 2.9386],
  "seme-kpodji": [6.3667, 2.6167],
};

export function cityPoint(city: string | null | undefined): [number, number] | null {
  if (!city) return null;
  const key = city.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
  return BENIN_CITIES[key] ?? null;
}
