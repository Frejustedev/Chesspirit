import { profileSchema as ps } from "./schemas";
import { describe, expect, it } from "vitest";
import { classifyCadence } from "./cadence";
import { formatXof, assertXof } from "./money";
import { ageOn, countdownParts, formatDate, isMinor } from "./time";
import { stagePoints, tourCategories, tourTotal, DEFAULT_TOUR_SCALE } from "./tour";
import { buildPgn, normalizeName, parsePgn } from "./pgn";
import { exportTrf, parseTrfPlayers } from "./trf";
import { answersSchema, phoneSchema, profileSchema } from "./schemas";

describe("cadences FIDE", () => {
  it("classe les ligues du brief", () => {
    expect(classifyCadence({ baseMinutes: 3, incrementSeconds: 2 })).toBe("blitz");
    expect(classifyCadence({ baseMinutes: 15, incrementSeconds: 10 })).toBe("rapid");
    expect(classifyCadence({ baseMinutes: 60, incrementSeconds: 30 })).toBe("classical");
    expect(classifyCadence({ baseMinutes: 10, incrementSeconds: 0 })).toBe("blitz");
    expect(classifyCadence({ baseMinutes: 45, incrementSeconds: 15 })).toBe("classical");
  });
});

describe("monnaie et dates", () => {
  it("XOF entier", () => {
    expect(formatXof(5000)).toBe("5 000 FCFA");
    expect(() => assertXof(10.5)).toThrow();
  });
  it("affiche en heure de Porto-Novo", () => {
    expect(formatDate("2026-10-03T07:30:00Z", "fr", { timeStyle: "short" })).toBe("08:30");
  });
  it("âge et mineurs", () => {
    expect(ageOn("2010-10-04", new Date("2026-10-03T00:00:00Z"))).toBe(15);
    expect(isMinor("2008-10-03", new Date("2026-10-03T00:00:00Z"))).toBe(false);
  });
  it("compte à rebours", () => {
    const c = countdownParts(new Date("2026-10-03T08:00:00Z"), new Date("2026-10-01T06:59:30Z"));
    expect(c).toMatchObject({ days: 2, hours: 1, minutes: 0, seconds: 30, done: false });
  });
});

describe("Chesspirit Tour", () => {
  it("barème par défaut", () => {
    expect(DEFAULT_TOUR_SCALE.slice(0, 11)).toEqual([100, 80, 65, 55, 50, 45, 40, 36, 32, 29, 28]);
    expect(DEFAULT_TOUR_SCALE.at(-1)).toBe(1);
    expect(stagePoints(1, 1)).toBe(105);
    expect(stagePoints(1, 1.5)).toBe(157.5);
    expect(stagePoints(200, 1)).toBe(5);
  });
  it("6 meilleurs résultats", () => {
    expect(tourTotal([10, 50, 20, 30, 40, 60, 70, 5])).toBe(270);
  });
  it("catégories", () => {
    expect(tourCategories({ age: 13, sex: "F", rating: 1500 })).toEqual([
      "general",
      "u18",
      "u14",
      "women",
      "amateur",
    ]);
  });
});

describe("PGN", () => {
  const two = `[Event "Démo"]\n[White "Doe, John"]\n[Black "Roe"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0\n\n[Event "Démo"]\n[White "A"]\n[Black "B"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2\n`;
  it("découpe et lit les en-têtes", () => {
    const g = parsePgn(two);
    expect(g).toHaveLength(2);
    expect(g[0]!.headers.White).toBe("Doe, John");
    expect(g[1]!.movetext).toBe("1. d4 d5 1/2-1/2");
  });
  it("construit un PGN", () => {
    expect(buildPgn({ White: "A", Event: "X" }, "1. e4 *")).toBe(
      '[Event "X"]\n[White "A"]\n\n1. e4 *\n',
    );
  });
  it("normalise les noms", () => {
    expect(normalizeName("Kpénou, Aïcha")).toBe(normalizeName("aicha KPENOU"));
  });
});

describe("TRF", () => {
  it("aligne les colonnes et se relit", () => {
    const trf = exportTrf(
      {
        name: "Test",
        city: "Cotonou",
        federation: "BEN",
        startDate: "2026/10/03",
        endDate: "2026/10/03",
        chiefArbiter: "Arbitre",
        timeControl: "15+10",
        rounds: 1,
        roundDates: ["26/10/03"],
      },
      [
        {
          startNo: 1,
          sex: "m",
          title: "",
          name: "Doe, John",
          rating: 1850,
          federation: "BEN",
          fideId: "12345678",
          birthDate: "1990/01/01",
          points: 1,
          rank: 1,
          rounds: [{ opponent: 2, color: "w", result: "1" }],
        },
      ],
    );
    const line = trf.split("\n").find((l) => l.startsWith("001"))!;
    expect(line.slice(91, 95)).toBe("   2");
    expect(line[96]).toBe("w");
    expect(line[98]).toBe("1");
    expect(
      trf
        .split("\n")
        .find((l) => l.startsWith("132"))!
        .slice(91, 99),
    ).toBe("26/10/03");
    expect(parseTrfPlayers(trf)[0]).toMatchObject({
      startNo: 1,
      name: "Doe, John",
      rating: 1850,
      points: 1,
      rank: 1,
    });
  });
});

describe("schémas", () => {
  it("numéro béninois", () => {
    expect(phoneSchema.parse("01 97 00 00 00")).toBe("+2290197000000");
    expect(phoneSchema.safeParse("abc").success).toBe(false);
  });
  it("profil minimal", () => {
    const r = profileSchema.safeParse({
      first_name: "Aïcha",
      last_name: "Démo",
      birth_date: "2001-05-02",
      sex: "F",
      city: "Cotonou",
      department: "Littoral",
    });
    expect(r.success).toBe(true);
  });
  it("champs personnalisés", () => {
    const s = answersSchema([
      {
        key: "tshirt",
        label: { fr: "Taille", en: "Size" },
        type: "select",
        required: true,
        options: ["S", "M"],
      },
      { key: "meal", label: { fr: "Repas", en: "Meal" }, type: "checkbox", required: false },
    ]);
    expect(s.safeParse({ tshirt: "M" }).success).toBe(true);
    expect(s.safeParse({ tshirt: "XL" }).success).toBe(false);
  });
});

describe("profil et pays", () => {
  const base = {
    first_name: "A",
    last_name: "B",
    birth_date: "1990-01-01",
    sex: "F",
    city: "Lomé",
  };
  it("exige le département pour le Bénin seulement", () => {
    expect(ps.safeParse({ ...base, country: "BJ" }).success).toBe(false);
    expect(ps.safeParse({ ...base, country: "BJ", department: "Littoral" }).success).toBe(true);
    expect(ps.safeParse({ ...base, country: "TG" }).success).toBe(true);
    expect(ps.safeParse({ ...base, country: "tg" }).success).toBe(false);
  });
});

describe("catégories du Tour sans âge exact des mineurs", () => {
  it("utilise la tranche d'âge publiée", () => {
    expect(tourCategories({ age: null, ageGroup: "u14", sex: null, rating: 1700 })).toEqual([
      "general",
      "u18",
      "u14",
    ]);
    expect(tourCategories({ age: null, ageGroup: "u18", sex: null, rating: 1700 })).toEqual([
      "general",
      "u18",
    ]);
  });
});
