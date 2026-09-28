import { describe, expect, it } from "vitest";
import { detectIntent } from "./whatsapp-intent";

describe("assistant WhatsApp", () => {
  it("reconnaît les demandes courantes", () => {
    expect(detectIntent("Quand est le prochain tournoi ?").kind).toBe("next_tournament");
    expect(detectIntent("Je veux m'inscrire").kind).toBe("registration");
    expect(detectIntent("Classement")).toEqual({ kind: "ranking" });
    expect(detectIntent("Des cours pour mon fils ?").kind).toBe("coaching");
    expect(detectIntent("Je veux parler à un humain").kind).toBe("human");
    expect(detectIntent("STOP").kind).toBe("stop");
    expect(detectIntent("bonjour").kind).toBe("help");
  });
  it("extrait le nom pour la cote", () => {
    expect(detectIntent("Cote Ahouansou")).toEqual({ kind: "rating", name: "ahouansou" });
    expect(detectIntent("élo  Kossi Dossou ")).toEqual({ kind: "rating", name: "kossi dossou" });
  });
});
