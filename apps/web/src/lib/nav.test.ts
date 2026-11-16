import { describe, expect, it } from "vitest";
import { locatePage } from "./nav";

describe("locatePage (titre courant)", () => {
  it("situe une page de rubrique avec sa lettre de colonne et sa page la plus proche", () => {
    const l = locatePage("/competitions/ligues/saison-demo-l1-classique");
    expect(l.section).toEqual({ key: "competitions", href: "/competitions", file: "b" });
    expect(l.item?.key).toBe("leagues");
    expect(l.area).toBeNull();
  });

  it("retient la page la plus précise de la rubrique", () => {
    expect(locatePage("/classements").item?.key).toBe("rating");
    expect(locatePage("/classements/fide").item?.key).toBe("fide");
    expect(locatePage("/communaute/").section?.file).toBe("h");
  });

  it("rattache les pages hors menu à leur rubrique", () => {
    expect(locatePage("/parties/123").section?.key).toBe("competitions");
    expect(locatePage("/joueurs/abc").section?.key).toBe("rankings");
    expect(locatePage("/membre/CARTE").section?.key).toBe("community");
  });

  it("nomme les zones hors rubrique", () => {
    expect(locatePage("/admin/tournois/1")).toMatchObject({ section: null, area: "admin" });
    expect(locatePage("/compte/profil").area).toBe("account");
    expect(locatePage("/legal/cgu")).toMatchObject({ area: "legal", item: { key: "terms" } });
    expect(locatePage("/faq")).toMatchObject({ area: "info", item: { key: "faq" } });
  });

  it("ne situe pas l'accueil ni une page inconnue", () => {
    expect(locatePage("/")).toEqual({ section: null, item: null, area: null });
    expect(locatePage("/inconnue")).toEqual({ section: null, item: null, area: null });
  });

  it("ne confond pas un préfixe de mot avec une rubrique", () => {
    expect(locatePage("/coachingx").section).toBeNull();
  });
});
