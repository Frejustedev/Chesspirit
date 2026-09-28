/**
 * Données initiales.
 *   pnpm seed            → tournoi du 3 octobre 2026 (faits connus) + données de démonstration
 *   pnpm seed --no-demo  → uniquement le tournoi du 3 octobre (à utiliser en production)
 * Les données de démonstration sont fictives et marquées is_demo = true.
 */
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import {
  bergerTables,
  computeStandings,
  type PairingInput,
  type ResultCode,
  buildPgn,
} from "@chesspirit/shared";

const LOCAL_URL = "http://localhost:54321";
// Clé « service_role » de démonstration de la CLI Supabase : valable uniquement en local.
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? LOCAL_URL;
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (isLocal ? LOCAL_SERVICE_KEY : "");
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY requis hors environnement local");
const withDemo = !process.argv.includes("--no-demo");
if (withDemo && !isLocal && !process.argv.includes("--force-demo")) {
  throw new Error(
    "Refus : données de démonstration sur une base distante. Utilisez --no-demo (ou --force-demo).",
  );
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(res: { data: T; error: unknown }, what: string): T {
  if (res.error) {
    console.error(`✗ ${what}`, res.error);
    process.exit(1);
  }
  return res.data;
}

// Générateur pseudo-aléatoire reproductible.
let seed = 20261003;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

// ---------------------------------------------------------------------------
// 1. Tournoi du 3 octobre 2026 — uniquement les faits connus, le reste « À confirmer »
// ---------------------------------------------------------------------------
async function seedLaunchTournament() {
  const slug = "tournoi-chesspirit-2026";
  const existing = must(
    await db.from("tournaments").select("id").eq("slug", slug).maybeSingle(),
    "lecture tournoi",
  );
  if (existing) {
    console.log("• Tournoi du 3 octobre déjà présent (non modifié)");
    return existing.id as string;
  }
  const t = must(
    await db
      .from("tournaments")
      .insert({
        slug,
        name: "Tournoi Chesspirit",
        edition: "1re édition",
        summary: {
          fr: "Le premier tournoi Chesspirit, en cadence rapide, à la FSS de Cotonou.",
          en: "The first Chesspirit tournament, a rapid event at the FSS in Cotonou.",
        },
        description: {
          fr: "Premier tournoi organisé par Chesspirit, en cadence rapide, le samedi 3 octobre 2026 à la FSS de Cotonou, avec la FSS et Ayelade Chess comme partenaires. Le programme, la cadence exacte, le nombre de rondes, les frais et les dotations seront publiés ici dès qu'ils seront confirmés.",
          en: "Chesspirit's first tournament, played at rapid time control on Saturday 3 October 2026 at the FSS in Cotonou, with the FSS and Ayelade Chess as partners. The schedule, exact time control, number of rounds, fees and prizes will be published here once confirmed.",
        },
        venue: "FSS",
        city: "Cotonou",
        country: "BJ",
        // Heure de début non communiquée : minuit (heure de Porto-Novo), horaires « À confirmer ».
        starts_at: "2026-10-02T23:00:00Z",
        cadence: "rapid",
        pairing_system: "swiss_dutch",
        status: "registration_open",
        allow_online_payment: true,
        allow_on_site_payment: true,
        rated: false,
        unconfirmed_fields: [
          "schedule",
          "time_control",
          "rounds",
          "pairing_system",
          "fee",
          "prizes",
          "capacity",
          "rated",
        ],
      })
      .select("id")
      .single(),
    "création tournoi",
  );
  must(
    await db.from("tournament_partners").insert([
      { tournament_id: t.id, name: "FSS", role: "host", position: 1 },
      { tournament_id: t.id, name: "Ayelade Chess", role: "partner", position: 2 },
    ]),
    "partenaires",
  );
  must(
    await db.from("registration_forms").insert({ tournament_id: t.id, fields: [] }),
    "formulaire",
  );
  console.log("✓ Tournoi du 3 octobre 2026 créé (faits connus uniquement)");
  return t.id as string;
}

// ---------------------------------------------------------------------------
// 2. Démonstration
// ---------------------------------------------------------------------------
const FIRST_M = [
  "Koffi",
  "Sèdjro",
  "Rodrigue",
  "Ulrich",
  "Gildas",
  "Arnaud",
  "Fiacre",
  "Hervé",
  "Romaric",
  "Mahougnon",
  "Brice",
  "Landry",
  "Elvis",
  "Codjo",
  "Serge",
  "Aurel",
  "Parfait",
  "Crépin",
  "Jonas",
  "Ismaël",
];
const FIRST_F = [
  "Aïcha",
  "Nadège",
  "Sênami",
  "Grâce",
  "Mireille",
  "Rachida",
  "Ornella",
  "Fifamè",
  "Carine",
  "Estelle",
  "Mariam",
  "Prudence",
];
const LAST = [
  "Adjovi",
  "Houngbédji",
  "Dossou",
  "Agossou",
  "Tossou",
  "Zinsou",
  "Akpovi",
  "Gbaguidi",
  "Hounkpatin",
  "Kiki",
  "Sossa",
  "Amoussou",
  "Ahouandjinou",
  "Fagla",
  "Lokossou",
  "Dansou",
  "Quenum",
  "Yessoufou",
  "Bio",
  "Sanni",
];
const CITIES: [string, string][] = [
  ["Cotonou", "Littoral"],
  ["Porto-Novo", "Ouémé"],
  ["Abomey-Calavi", "Atlantique"],
  ["Parakou", "Borgou"],
  ["Bohicon", "Zou"],
  ["Natitingou", "Atacora"],
];

async function ensureUser(email: string, phone: string) {
  const list = must(await db.auth.admin.listUsers({ perPage: 1000 }), "liste utilisateurs");
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const created = must(
    await db.auth.admin.createUser({ email, phone, email_confirm: true, phone_confirm: true }),
    `création ${email}`,
  );
  return created.user!.id;
}

function randomGame(maxPlies: number) {
  const g = new Chess();
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  for (let i = 0; i < maxPlies && !g.isGameOver(); i++) {
    const moves = g.moves({ verbose: true });
    const scored = moves.map((m) => ({
      m,
      s:
        (m.captured ? values[m.captured]! * 3 - values[m.piece]! : 0) +
        (m.san.includes("+") ? 2 : 0) +
        (i < 8 && "pn".includes(m.piece) ? 1.5 : 0) +
        rand() * 3,
    }));
    scored.sort((a, b) => b.s - a.s);
    g.move(scored[Math.floor(rand() * Math.min(3, scored.length))]!.m);
  }
  return g;
}

async function seedDemo() {
  const existing = must(
    await db.from("tournaments").select("id").eq("slug", "open-demo-cotonou").maybeSingle(),
    "lecture démo",
  );
  if (existing) {
    console.log("• Données de démonstration déjà présentes");
    return;
  }

  // Structures
  const orgs = must(
    await db
      .from("organizations")
      .insert([
        {
          type: "club",
          name: "Club démo de Cotonou",
          slug: "club-demo-cotonou",
          city: "Cotonou",
          department: "Littoral",
          lat: 6.3654,
          lng: 2.4183,
          is_demo: true,
          verified: true,
        },
        {
          type: "club",
          name: "Échiquier démo de Porto-Novo",
          slug: "echiquier-demo-porto-novo",
          city: "Porto-Novo",
          department: "Ouémé",
          lat: 6.4969,
          lng: 2.6289,
          is_demo: true,
          verified: false,
        },
        {
          type: "school",
          name: "École d'échecs démo de Parakou",
          slug: "ecole-demo-parakou",
          city: "Parakou",
          department: "Borgou",
          lat: 9.3372,
          lng: 2.6303,
          is_demo: true,
          verified: false,
        },
      ])
      .select("id, name, city"),
    "structures",
  );

  // Joueurs
  const players: { id: string; name: string; rating: number; sex: "M" | "F" }[] = [];
  const rows = [];
  for (let i = 0; i < 36; i++) {
    const sex: "M" | "F" = i % 4 === 3 ? "F" : "M";
    const first = sex === "F" ? pick(FIRST_F) : pick(FIRST_M);
    const last = pick(LAST);
    const [city, dep] = pick(CITIES);
    const org = pick(orgs);
    const year = i % 6 === 0 ? 2010 + Math.floor(rand() * 5) : 1975 + Math.floor(rand() * 30);
    rows.push({
      first_name: first,
      last_name: last,
      birth_date: `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`,
      sex,
      city,
      department: dep,
      club_id: org.id,
      is_public: true,
      source: "demo",
      is_demo: true,
      onboarded: true,
      fide_id: i < 5 ? String(66000000 + i * 1013) : null,
      titles: i === 0 ? ["FM"] : i === 1 ? ["CM"] : [],
    });
  }
  const inserted = must(
    await db.from("profiles").insert(rows).select("id, first_name, last_name, sex, is_minor"),
    "joueurs",
  );
  // Les mineurs de démonstration restent en profil réduit ; on rend public uniquement les adultes.
  inserted.forEach((p, i) => {
    const rating = Math.round(2150 - i * 26 + (rand() - 0.5) * 60);
    players.push({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      rating,
      sex: p.sex as "M" | "F",
    });
  });

  must(
    await db.from("ratings").insert(
      players.flatMap((p) => [
        {
          profile_id: p.id,
          type: "rapid",
          rating: p.rating,
          games: 30 + Math.floor(rand() * 40),
          provisional: false,
          peak: p.rating + 20,
        },
        {
          profile_id: p.id,
          type: "blitz",
          rating: p.rating - 40 + Math.round(rand() * 80),
          games: 40,
          provisional: false,
          peak: p.rating + 30,
        },
        {
          profile_id: p.id,
          type: "classical",
          rating: p.rating + 15,
          games: 12,
          provisional: rand() < 0.2,
          peak: p.rating + 15,
        },
      ]),
    ),
    "cotes",
  );

  // Comptes de démonstration
  const playerUser = await ensureUser("joueur@demo.chesspirit.local", "+22990000001");
  const adminUser = await ensureUser("admin@demo.chesspirit.local", "+22990000009");
  const arbiterUser = await ensureUser("arbitre@demo.chesspirit.local", "+22990000005");
  must(
    await db
      .from("profiles")
      .update({
        user_id: playerUser,
        phone: "+22990000001",
        email: "joueur@demo.chesspirit.local",
        claimed: true,
      })
      .eq("id", players[7]!.id),
    "compte joueur",
  );
  must(
    await db.from("profiles").insert([
      {
        user_id: adminUser,
        first_name: "Admin",
        last_name: "Démo",
        birth_date: "1988-04-12",
        sex: "F",
        city: "Cotonou",
        department: "Littoral",
        source: "demo",
        is_demo: true,
        onboarded: true,
        phone: "+22990000009",
      },
      {
        user_id: arbiterUser,
        first_name: "Arbitre",
        last_name: "Démo",
        birth_date: "1979-09-30",
        sex: "M",
        city: "Cotonou",
        department: "Littoral",
        source: "demo",
        is_demo: true,
        onboarded: true,
        phone: "+22990000005",
      },
    ]),
    "profils admin/arbitre",
  );
  must(
    await db.from("user_roles").insert([
      { user_id: playerUser, role: "player" },
      { user_id: adminUser, role: "super_admin" },
      { user_id: arbiterUser, role: "arbiter" },
    ]),
    "rôles",
  );

  // Tournoi passé : Open de démonstration (5 rondes, suisse simplifié)
  const field = players.slice(0, 24);
  const t = must(
    await db
      .from("tournaments")
      .insert({
        slug: "open-demo-cotonou",
        name: "Open de démonstration de Cotonou",
        summary: {
          fr: "Tournoi fictif servant à la démonstration.",
          en: "Fictitious tournament used for demonstration.",
        },
        description: {
          fr: "Tournoi fictif : joueurs, résultats et parties sont générés automatiquement.",
          en: "Fictitious tournament: players, results and games are generated.",
        },
        venue: "Salle démo",
        city: "Cotonou",
        starts_at: "2026-06-13T08:00:00Z",
        ends_at: "2026-06-13T18:00:00Z",
        cadence: "rapid",
        base_minutes: 15,
        increment_seconds: 10,
        rounds_count: 5,
        entry_fee_xof: 2000,
        capacity: 40,
        rated: true,
        status: "finished",
        results_published: true,
        is_demo: true,
      })
      .select("id")
      .single(),
    "tournoi démo",
  );
  must(
    await db.from("registrations").insert(
      field.map((p) => ({
        tournament_id: t.id,
        player_id: p.id,
        status: "confirmed",
        payment_status: "paid",
        payment_method: "on_site",
        amount_xof: 2000,
        seed_rating: p.rating,
        checked_in_at: "2026-06-13T07:45:00Z",
        source: "admin",
      })),
    ),
    "inscriptions démo",
  );

  const score = new Map(field.map((p) => [p.id, 0]));
  const met = new Set<string>();
  const pairings: PairingInput[] = [];
  const games: Record<string, unknown>[] = [];
  for (let r = 1; r <= 5; r++) {
    const round = must(
      await db
        .from("rounds")
        .insert({
          tournament_id: t.id,
          number: r,
          status: "finished",
          published_at: "2026-06-13T08:00:00Z",
        })
        .select("id")
        .single(),
      "ronde",
    );
    const order = [...field].sort(
      (a, b) => score.get(b.id)! - score.get(a.id)! || b.rating - a.rating,
    );
    const board: [(typeof field)[number], (typeof field)[number]][] = [];
    const left = [...order];
    while (left.length > 1) {
      const a = left.shift()!;
      const idx = left.findIndex((b) => !met.has([a.id, b.id].sort().join()));
      const [b] = left.splice(idx === -1 ? 0 : idx, 1);
      met.add([a.id, b!.id].sort().join());
      board.push(r % 2 ? [a, b!] : [b!, a]);
    }
    const prs = [];
    for (let i = 0; i < board.length; i++) {
      const [w, b] = board[i]!;
      const pw = 1 / (1 + 10 ** ((b.rating - w.rating) / 400));
      const x = rand();
      const result: ResultCode = x < pw * 0.8 ? "1-0" : x < pw * 0.8 + 0.2 ? "1/2-1/2" : "0-1";
      score.set(w.id, score.get(w.id)! + (result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5));
      score.set(b.id, score.get(b.id)! + (result === "0-1" ? 1 : result === "1-0" ? 0 : 0.5));
      pairings.push({ round: r, white: w.id, black: b.id, result });
      prs.push({
        tournament_id: t.id,
        round_id: round.id,
        board: i + 1,
        white_id: w.id,
        black_id: b.id,
        result,
      });
      const g = randomGame(40 + Math.floor(rand() * 50));
      const moves = g
        .pgn()
        .replace(/\[.*\]\s*/g, "")
        .replace(/\s*\*\s*$/, "")
        .trim();
      const gameResult = g.isCheckmate() ? (g.turn() === "w" ? "0-1" : "1-0") : result;
      games.push({
        tournament_id: t.id,
        round_id: round.id,
        round_number: r,
        board: i + 1,
        white_id: w.id,
        black_id: b.id,
        white_name: w.name,
        black_name: b.name,
        white_rating: w.rating,
        black_rating: b.rating,
        result: gameResult,
        pgn: buildPgn(
          {
            Event: "Open de démonstration de Cotonou",
            Site: "Cotonou BEN",
            Date: "2026.06.13",
            Round: String(r),
            White: w.name,
            Black: b.name,
            Result: gameResult,
            WhiteElo: String(w.rating),
            BlackElo: String(b.rating),
            Annotator: "Chesspirit (démonstration)",
          },
          `${moves} ${gameResult}`,
        ),
        moves_count: Math.ceil(g.history().length / 2),
        played_on: "2026-06-13",
        cadence: "rapid",
        source: "import",
      });
    }
    must(await db.from("pairings").insert(prs), "appariements");
  }
  must(await db.from("games").insert(games), "parties");
  const standings = computeStandings(
    field.map((p) => ({ id: p.id, name: p.name, rating: p.rating })),
    pairings,
    ["buchholz_cut1", "buchholz", "sonneborn_berger"],
  );
  must(
    await db.from("standings").insert(
      standings.map((s) => ({
        tournament_id: t.id,
        player_id: s.playerId,
        rank: s.rank,
        points: s.points,
        games: s.games,
        tiebreaks: s.tiebreaks,
        performance: s.tiebreaks.performance,
        rating_before: s.rating,
        is_final: true,
      })),
    ),
    "classement",
  );

  // Tournoi à venir avec frais (pour tester le paiement)
  const blitz = must(
    await db
      .from("tournaments")
      .insert({
        slug: "blitz-demo-porto-novo",
        name: "Blitz de démonstration de Porto-Novo",
        summary: {
          fr: "Tournoi fictif pour tester l'inscription et le paiement.",
          en: "Fictitious tournament to test registration and payment.",
        },
        venue: "Salle démo",
        city: "Porto-Novo",
        starts_at: "2026-11-14T14:00:00Z",
        cadence: "blitz",
        base_minutes: 3,
        increment_seconds: 2,
        rounds_count: 9,
        entry_fee_xof: 1500,
        capacity: 32,
        rated: true,
        status: "registration_open",
        is_demo: true,
      })
      .select("id")
      .single(),
    "blitz démo",
  );
  must(
    await db.from("registration_forms").insert({
      tournament_id: blitz.id,
      fields: [
        {
          key: "tshirt",
          label: { fr: "Taille de t-shirt", en: "T-shirt size" },
          type: "select",
          required: false,
          options: ["S", "M", "L", "XL"],
        },
        {
          key: "meal",
          label: { fr: "Repas sur place", en: "Meal on site" },
          type: "checkbox",
          required: false,
        },
      ],
    }),
    "formulaire blitz",
  );
  must(
    await db.from("tournament_staff").insert({
      tournament_id: blitz.id,
      profile_id: must(
        await db.from("profiles").select("id").eq("user_id", arbiterUser).single(),
        "profil arbitre",
      ).id,
      role: "chief_arbiter",
    }),
    "arbitre",
  );
  console.log(
    `✓ Démonstration : ${players.length} joueurs, 3 structures, 2 tournois, ${games.length} parties`,
  );
  console.log(
    "  Comptes : joueur@demo.chesspirit.local (+22990000001), arbitre@demo.chesspirit.local, admin@demo.chesspirit.local (super_admin, 2FA requise)",
  );
}

async function seedCoachingDemo() {
  const existing = must(
    await db.from("coach_profiles").select("id").eq("slug", "coach-demo-cotonou").maybeSingle(),
    "lecture coachs",
  );
  if (existing) {
    console.log("• Coaching de démonstration déjà présent");
    return;
  }
  const coachUser = await ensureUser("coach@demo.chesspirit.local", "+22990000003");
  const people = must(
    await db
      .from("profiles")
      .insert([
        {
          user_id: coachUser,
          first_name: "Coach",
          last_name: "Démo",
          birth_date: "1984-02-11",
          sex: "M",
          city: "Cotonou",
          department: "Littoral",
          source: "demo",
          is_demo: true,
          onboarded: true,
          phone: "+22990000003",
          is_public: true,
          titles: ["FM"],
        },
        {
          user_id: null,
          first_name: "Afi",
          last_name: "Démo",
          birth_date: "1992-06-20",
          sex: "F",
          city: "Porto-Novo",
          department: "Ouémé",
          source: "demo",
          is_demo: true,
          onboarded: true,
          phone: null,
          is_public: true,
          titles: [],
        },
        {
          user_id: null,
          first_name: "Kossi",
          last_name: "Démo",
          birth_date: "1979-10-03",
          sex: "M",
          city: "Parakou",
          department: "Borgou",
          source: "demo",
          is_demo: true,
          onboarded: true,
          phone: null,
          is_public: true,
          titles: ["CM"],
        },
      ])
      .select("id"),
    "profils coachs",
  );
  must(await db.from("user_roles").insert({ user_id: coachUser, role: "coach" }), "rôle coach");
  const coaches = must(
    await db
      .from("coach_profiles")
      .insert([
        {
          profile_id: people[0]!.id,
          slug: "coach-demo-cotonou",
          status: "approved",
          is_chesspirit: true,
          is_demo: true,
          languages: ["fr", "en"],
          modalities: ["in_person", "online"],
          levels: ["intermediate", "advanced", "competition"],
          city: "Cotonou",
          headline: {
            fr: "Préparation aux tournois et analyse de parties (démonstration)",
            en: "Tournament preparation and game analysis (demo)",
          },
          bio: { fr: "Profil fictif de démonstration.", en: "Fictitious demo profile." },
          specialties: ["Ouvertures", "Finales"],
        },
        {
          profile_id: people[1]!.id,
          slug: "afi-demo-porto-novo",
          status: "approved",
          is_chesspirit: false,
          is_demo: true,
          languages: ["fr", "fon"],
          modalities: ["in_person"],
          levels: ["discovery", "beginner"],
          city: "Porto-Novo",
          headline: {
            fr: "Initiation des enfants, en français et en fon (démonstration)",
            en: "Kids' introduction, in French and Fon (demo)",
          },
          bio: { fr: "Profil fictif de démonstration.", en: "Fictitious demo profile." },
          specialties: ["Enfants", "Écoles"],
        },
        {
          profile_id: people[2]!.id,
          slug: "kossi-demo-parakou",
          status: "approved",
          is_chesspirit: false,
          is_demo: true,
          languages: ["fr"],
          modalities: ["online"],
          levels: ["beginner", "intermediate"],
          city: "Parakou",
          headline: {
            fr: "Cours en ligne pour adultes (démonstration)",
            en: "Online lessons for adults (demo)",
          },
          bio: { fr: "Profil fictif de démonstration.", en: "Fictitious demo profile." },
          specialties: ["Tactique"],
        },
      ])
      .select("id, slug"),
    "coachs",
  );
  const [c1, c2, c3] = coaches;
  const offers = must(
    await db
      .from("offers")
      .insert([
        {
          coach_id: c1!.id,
          title: { fr: "Préparation de tournoi", en: "Tournament preparation" },
          language: "fr",
          modality: "online",
          level: "advanced",
          format: "individual",
          duration_min: 90,
          price_xof: 15000,
          capacity: 1,
        },
        {
          coach_id: c1!.id,
          title: { fr: "Analyse de vos parties", en: "Analysis of your games" },
          language: "en",
          modality: "in_person",
          level: "intermediate",
          format: "individual",
          duration_min: 60,
          price_xof: 10000,
          capacity: 1,
        },
        {
          coach_id: c2!.id,
          title: { fr: "Atelier découverte pour enfants", en: "Kids' discovery workshop" },
          language: "fon",
          modality: "in_person",
          level: "discovery",
          format: "group",
          duration_min: 60,
          price_xof: 2000,
          capacity: 8,
        },
        {
          coach_id: c2!.id,
          title: { fr: "Premiers pas (adultes)", en: "First steps (adults)" },
          language: "fr",
          modality: "in_person",
          level: "beginner",
          format: "group",
          duration_min: 90,
          price_xof: 3000,
          capacity: 6,
        },
        {
          coach_id: c3!.id,
          title: { fr: "Tactique en ligne", en: "Tactics online" },
          language: "fr",
          modality: "online",
          level: "intermediate",
          format: "individual",
          duration_min: 60,
          price_xof: 8000,
          capacity: 1,
        },
      ])
      .select("id, coach_id, modality"),
    "offres",
  );
  const slots = [];
  for (const [coach, modality, location] of [
    [c1!.id, "online", null],
    [c1!.id, "in_person", "Club démo de Cotonou"],
    [c2!.id, "in_person", "Échiquier démo de Porto-Novo"],
    [c3!.id, "online", null],
  ] as const) {
    for (let d = 1; d <= 18; d += 3) {
      const start = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + d,
          15,
          0,
        ),
      );
      slots.push({
        coach_id: coach,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 90 * 60000).toISOString(),
        modality,
        location,
        capacity: modality === "in_person" && coach === c2!.id ? 8 : 1,
      });
    }
  }
  must(await db.from("availability_slots").insert(slots), "créneaux");
  void offers;
  console.log(
    `✓ Coaching de démonstration : 3 coachs, 5 offres, ${slots.length} créneaux (coach@demo.chesspirit.local, +22990000003)`,
  );
}

const CATEGORIES = [
  { slug: "echiquiers", fr: "Échiquiers et pièces", en: "Boards and pieces", position: 1 },
  { slug: "pendules-livres", fr: "Pendules et livres", en: "Clocks and books", position: 2 },
  { slug: "accessoires", fr: "Accessoires", en: "Accessories", position: 3 },
  { slug: "packs", fr: "Packs", en: "Bundles", position: 4 },
  { slug: "cartes-cadeaux", fr: "Cartes cadeaux", en: "Gift cards", position: 5 },
];

/** Catégories (structure réelle du site) et catalogue de démonstration. */
async function seedShop(demo: boolean) {
  must(
    await db.from("product_categories").upsert(
      CATEGORIES.map((c) => ({
        slug: c.slug,
        name: { fr: c.fr, en: c.en },
        position: c.position,
      })),
      { onConflict: "slug" },
    ),
    "catégories boutique",
  );
  if (!demo) return;
  const existing = must(
    await db.from("products").select("id").eq("slug", "echiquier-club-demo").maybeSingle(),
    "lecture produits",
  );
  if (existing) {
    console.log("• Boutique de démonstration déjà présente");
    return;
  }
  const cats = must(await db.from("product_categories").select("id, slug"), "catégories");
  const cat = (slug: string) => cats.find((c) => c.slug === slug)!.id;
  type P = {
    slug: string;
    cat: string;
    fr: string;
    en: string;
    dfr: string;
    den: string;
    price: number;
    compare?: number;
    art: string;
    kind?: "physical" | "gift_card";
    featured?: boolean;
    preorder?: string;
    variants: { fr: string; en: string; stock: number; price?: number }[];
  };
  const catalog: P[] = [
    {
      slug: "echiquier-club-demo",
      cat: "echiquiers",
      fr: "Échiquier de club roulable",
      en: "Roll-up club board",
      dfr: "Échiquier vinyle roulable, cases de 55 mm, idéal pour les clubs et tournois. Produit de démonstration.",
      den: "Roll-up vinyl board, 55 mm squares, for clubs and tournaments. Demo product.",
      price: 6500,
      art: "board",
      featured: true,
      variants: [
        { fr: "Vert", en: "Green", stock: 25 },
        { fr: "Bordeaux", en: "Burgundy", stock: 12 },
      ],
    },
    {
      slug: "pieces-staunton-demo",
      cat: "echiquiers",
      fr: "Pièces Staunton lestées",
      en: "Weighted Staunton pieces",
      dfr: "Jeu de pièces en plastique lesté, roi de 95 mm, avec deux dames supplémentaires. Produit de démonstration.",
      den: "Weighted plastic set, 95 mm king, two extra queens. Demo product.",
      price: 9000,
      art: "pieces",
      variants: [{ fr: "Standard", en: "Standard", stock: 18 }],
    },
    {
      slug: "echiquier-bois-demo",
      cat: "echiquiers",
      fr: "Échiquier en bois artisanal",
      en: "Handcrafted wooden board",
      dfr: "Plateau en bois fabriqué à Cotonou, finition vernie. Produit de démonstration.",
      den: "Wooden board crafted in Cotonou, varnished finish. Demo product.",
      price: 35000,
      compare: 40000,
      art: "board-wood",
      featured: true,
      variants: [
        { fr: "45 cm", en: "45 cm", stock: 4 },
        { fr: "50 cm", en: "50 cm", stock: 2, price: 42000 },
      ],
    },
    {
      slug: "pendule-numerique-demo",
      cat: "pendules-livres",
      fr: "Pendule numérique avec incrément",
      en: "Digital clock with increment",
      dfr: "Pendule homologable pour cadences Fischer et Bronstein. Produit de démonstration.",
      den: "Digital clock for Fischer and Bronstein time controls. Demo product.",
      price: 22000,
      art: "clock",
      featured: true,
      variants: [{ fr: "Noire", en: "Black", stock: 9 }],
    },
    {
      slug: "livre-initiation-demo",
      cat: "pendules-livres",
      fr: "Mes premiers pas aux échecs",
      en: "My first steps in chess",
      dfr: "Manuel d'initiation illustré pour les 7-12 ans. Produit de démonstration.",
      den: "Illustrated beginner's handbook for ages 7-12. Demo product.",
      price: 7500,
      art: "book",
      variants: [
        { fr: "Français", en: "French", stock: 30 },
        { fr: "Anglais", en: "English", stock: 0 },
      ],
    },
    {
      slug: "livre-tactique-demo",
      cat: "pendules-livres",
      fr: "Cahier de tactique, niveau 2",
      en: "Tactics workbook, level 2",
      dfr: "Trois cents exercices corrigés. Précommande : parution prévue, date à confirmer. Produit de démonstration.",
      den: "Three hundred solved exercises. Pre-order: release date to be confirmed. Demo product.",
      price: 9500,
      art: "book",
      preorder: "2026-12-01",
      variants: [{ fr: "Français", en: "French", stock: 0 }],
    },
    {
      slug: "sac-echecs-demo",
      cat: "accessoires",
      fr: "Sac de transport Chesspirit",
      en: "Chesspirit carry bag",
      dfr: "Sac pour échiquier roulable, pièces et pendule. Produit de démonstration.",
      den: "Bag for roll-up board, pieces and clock. Demo product.",
      price: 8000,
      art: "bag",
      variants: [{ fr: "Unique", en: "One size", stock: 15 }],
    },
    {
      slug: "t-shirt-demo",
      cat: "accessoires",
      fr: "T-shirt « Échec et mat »",
      en: "“Checkmate” T-shirt",
      dfr: "Coton, impression locale. Produit de démonstration.",
      den: "Cotton, printed locally. Demo product.",
      price: 6000,
      art: "shirt",
      variants: [
        { fr: "S", en: "S", stock: 6 },
        { fr: "M", en: "M", stock: 10 },
        { fr: "L", en: "L", stock: 3 },
        { fr: "XL", en: "XL", stock: 0 },
      ],
    },
    {
      slug: "pack-club-demo",
      cat: "packs",
      fr: "Pack club : 5 jeux complets",
      en: "Club bundle: 5 complete sets",
      dfr: "Cinq échiquiers roulables, cinq jeux de pièces et un sac. Produit de démonstration.",
      den: "Five roll-up boards, five piece sets and a bag. Demo product.",
      price: 70000,
      compare: 85000,
      art: "pack",
      featured: true,
      variants: [{ fr: "Standard", en: "Standard", stock: 5 }],
    },
    {
      slug: "carte-cadeau-demo",
      cat: "cartes-cadeaux",
      kind: "gift_card",
      fr: "Carte cadeau Chesspirit",
      en: "Chesspirit gift card",
      dfr: "Valable un an sur la boutique. Le code est envoyé après paiement. Produit de démonstration.",
      den: "Valid for one year in the shop. The code is sent after payment. Demo product.",
      price: 10000,
      art: "gift",
      variants: [
        { fr: "10 000 F CFA", en: "10,000 CFA", stock: 0, price: 10000 },
        { fr: "25 000 F CFA", en: "25,000 CFA", stock: 0, price: 25000 },
      ],
    },
  ];
  for (const p of catalog) {
    const row = must(
      await db
        .from("products")
        .insert({
          slug: p.slug,
          category_id: cat(p.cat),
          kind: p.kind ?? "physical",
          name: { fr: p.fr, en: p.en },
          description: { fr: p.dfr, en: p.den },
          price_xof: p.price,
          compare_at_xof: p.compare ?? null,
          art: p.art,
          is_featured: p.featured ?? false,
          is_preorder: !!p.preorder,
          preorder_date: p.preorder ?? null,
          is_demo: true,
        })
        .select("id")
        .single(),
      "produit",
    );
    must(
      await db.from("product_variants").insert(
        p.variants.map((v, i) => ({
          product_id: row.id,
          name: { fr: v.fr, en: v.en },
          stock: v.stock,
          price_xof: v.price ?? null,
          position: i,
          sku: `${p.slug}-${i + 1}`.toUpperCase(),
        })),
      ),
      "variantes",
    );
  }
  must(
    await db.from("promo_codes").insert([
      { code: "DEMO10", kind: "percent", value: 10, is_demo: true, max_uses_per_user: null },
      {
        code: "LIVRAISON-DEMO",
        kind: "free_shipping",
        value: 0,
        is_demo: true,
        max_uses_per_user: null,
      },
    ]),
    "codes promo",
  );
  must(
    await db.from("gift_cards").insert({
      code: "CAD-DEMO-0000-0001",
      initial_xof: 5000,
      balance_xof: 5000,
      status: "active",
      recipient_name: "Démonstration",
    }),
    "carte cadeau démo",
  );
  console.log(
    `✓ Boutique de démonstration : ${catalog.length} produits, codes DEMO10 et LIVRAISON-DEMO, carte CAD-DEMO-0000-0001`,
  );
}

const LEAGUE_FORMATS = {
  classical: {
    base: 60,
    inc: 30,
    closed: "round_robin",
    rounds: 11,
    fr: "Classique",
    en: "Classical",
  },
  rapid: { base: 15, inc: 10, closed: "double_round_robin", rounds: 22, fr: "Rapide", en: "Rapid" },
  blitz: { base: 3, inc: 2, closed: "double_round_robin", rounds: 22, fr: "Blitz", en: "Blitz" },
} as const;
const DIVISIONS = { l1: "Ligue 1", l2: "Ligue 2", amateur: "Ligue Amateur" } as const;
const SCHEDULE = {
  classical: {
    fr: "Une ronde toutes les deux semaines",
    en: "One round every two weeks",
  },
  rapid: { fr: "22 rondes sur 4 journées", en: "22 rounds over 4 matchdays" },
  blitz: { fr: "22 rondes sur 2 journées", en: "22 rounds over 2 matchdays" },
} as const;

async function ensureSeason(
  slug: string,
  name: string,
  startsOn: string,
  endsOn: string,
  isDemo: boolean,
) {
  const found = must(
    await db.from("seasons").select("id").eq("slug", slug).maybeSingle(),
    "saison",
  );
  if (found) return { id: found.id, created: false };
  const season = must(
    await db
      .from("seasons")
      .insert({
        slug,
        name,
        starts_on: startsOn,
        ends_on: endsOn,
        is_demo: isDemo,
        status: isDemo ? "active" : "planned",
      })
      .select("id")
      .single(),
    "saison",
  );
  const rows = [];
  for (const [division, divName] of Object.entries(DIVISIONS))
    for (const [cadence, f] of Object.entries(LEAGUE_FORMATS)) {
      const amateur = division === "amateur";
      rows.push({
        season_id: season.id,
        slug: `${slug}-${division}-${cadence === "classical" ? "classique" : cadence === "rapid" ? "rapide" : "blitz"}`,
        division,
        cadence: cadence as "blitz" | "rapid" | "classical",
        format: amateur ? "swiss" : f.closed,
        size: amateur ? null : 12,
        base_minutes: f.base,
        increment_seconds: f.inc,
        rounds_count: amateur ? null : f.rounds,
        schedule_note: amateur
          ? { fr: "Système suisse, une journée par mois", en: "Swiss system, one matchday a month" }
          : SCHEDULE[cadence as keyof typeof SCHEDULE],
      });
      void divName;
    }
  must(await db.from("leagues").insert(rows), "ligues");
  return { id: season.id, created: true };
}

/** Saison 2026-2027 (structure du dossier, calendrier à confirmer) et saison de démonstration. */
async function seedLeagues(demo: boolean) {
  const real = await ensureSeason(
    "2026-2027",
    "Saison 2026-2027",
    "2026-09-01",
    "2027-06-30",
    false,
  );
  if (real.created) {
    const cities = ["Cotonou", "Porto-Novo", "Abomey-Calavi", "Bohicon", "Parakou", "Natitingou"];
    must(
      await db.from("tour_stages").insert(
        cities.map((city, i) => ({
          season_id: real.id,
          number: i + 1,
          name: `Étape de ${city} (pressentie)`,
          city,
        })),
      ),
      "étapes pressenties",
    );
    console.log(
      "✓ Saison 2026-2027 : 9 ligues et 6 étapes pressenties du Tour (dates à confirmer)",
    );
  }
  if (!demo) return;
  const d = await ensureSeason(
    "saison-demo",
    "Saison de démonstration",
    "2025-09-01",
    "2026-06-30",
    true,
  );
  if (!d.created) {
    console.log("• Saison de démonstration déjà présente");
    return;
  }
  const { data: league } = await db
    .from("leagues")
    .select("id")
    .eq("slug", "saison-demo-l1-classique")
    .single();
  const people = must(
    await db
      .from("profiles")
      .select("id, first_name, last_name, ratings(rating, type)")
      .eq("is_demo", true)
      .is("user_id", null)
      .limit(12),
    "joueurs démo",
  )
    .map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      rating:
        (p.ratings as { rating: number; type: string }[]).find((r) => r.type === "classical")
          ?.rating ?? 1500,
    }))
    .sort((a, b) => b.rating - a.rating);
  must(
    await db
      .from("league_members")
      .insert(people.map((p, i) => ({ league_id: league!.id, profile_id: p.id, seed: i + 1 }))),
    "membres ligue démo",
  );
  const t = must(
    await db
      .from("tournaments")
      .insert({
        slug: "ligue-1-classique-demo",
        name: "Ligue 1 classique — démonstration",
        summary: {
          fr: "Ligue fictive servant à la démonstration.",
          en: "Fictitious league used for demonstration.",
        },
        city: "Cotonou",
        venue: "Salle démo",
        starts_at: "2025-10-04T09:00:00Z",
        ends_at: "2026-03-07T18:00:00Z",
        cadence: "classical",
        base_minutes: 60,
        increment_seconds: 30,
        rounds_count: 11,
        pairing_system: "round_robin",
        tiebreaks: ["sonneborn_berger", "wins"],
        rated: true,
        status: "finished",
        results_published: true,
        league_id: league!.id,
        is_demo: true,
      })
      .select("id")
      .single(),
    "tournoi de ligue démo",
  );
  must(
    await db.from("registrations").insert(
      people.map((p, i) => ({
        tournament_id: t.id,
        player_id: p.id,
        status: "confirmed",
        payment_status: "not_required",
        seed_rating: p.rating,
        start_number: i + 1,
        source: "admin",
      })),
    ),
    "inscriptions ligue démo",
  );
  const tables = bergerTables(people.length);
  const pairings: PairingInput[] = [];
  for (let r = 1; r <= 11; r++) {
    const round = must(
      await db
        .from("rounds")
        .insert({
          tournament_id: t.id,
          number: r,
          status: "finished",
          published_at: "2025-10-04T09:00:00Z",
        })
        .select("id")
        .single(),
      "ronde ligue",
    );
    const rows = tables
      .filter((x) => x.round === r)
      .map((x) => {
        const w = people[x.white - 1]!;
        const b = people[x.black - 1]!;
        const pw = 1 / (1 + 10 ** ((b.rating - w.rating) / 400));
        const u = rand();
        const result: ResultCode = u < pw * 0.75 ? "1-0" : u < pw * 0.75 + 0.3 ? "1/2-1/2" : "0-1";
        pairings.push({ round: r, white: w.id, black: b.id, result });
        return {
          tournament_id: t.id,
          round_id: round.id,
          board: x.board,
          white_id: w.id,
          black_id: b.id,
          result,
        };
      });
    must(await db.from("pairings").insert(rows), "appariements ligue");
  }
  const st = computeStandings(people, pairings, ["sonneborn_berger", "wins"]);
  must(
    await db.from("standings").insert(
      st.map((s) => ({
        tournament_id: t.id,
        player_id: s.playerId,
        rank: s.rank,
        points: s.points,
        games: s.games,
        tiebreaks: s.tiebreaks,
        rating_before: s.rating,
        is_final: true,
      })),
    ),
    "classement ligue",
  );
  must(
    await db
      .from("league_matchdays")
      .insert({ league_id: league!.id, number: 1, rounds: "1-11", tournament_id: t.id }),
    "journée",
  );
  must(
    await db
      .from("leagues")
      .update({ status: "finished", champion_id: st[0]!.playerId })
      .eq("id", league!.id),
    "champion",
  );
  // Tour de démonstration : l'Open démo est une Majeure (coefficient 1,5).
  const { data: open } = await db
    .from("tournaments")
    .select("id")
    .eq("slug", "open-demo-cotonou")
    .single();
  const { data: blitz } = await db
    .from("tournaments")
    .select("id")
    .eq("slug", "blitz-demo-porto-novo")
    .single();
  must(
    await db.from("tour_stages").insert([
      {
        season_id: d.id,
        number: 1,
        name: "Open de démonstration de Cotonou",
        city: "Cotonou",
        kind: "major",
        coefficient: 1.5,
        tournament_id: open?.id ?? null,
        planned_on: "2026-06-13",
      },
      {
        season_id: d.id,
        number: 2,
        name: "Blitz de démonstration de Porto-Novo",
        city: "Porto-Novo",
        kind: "regular",
        coefficient: 1,
        tournament_id: blitz?.id ?? null,
        planned_on: "2026-11-14",
      },
    ]),
    "étapes démo",
  );
  if (open) must(await db.rpc("compute_tour_points", { p_tournament: open.id }), "points du Tour");
  console.log("✓ Saison de démonstration : Ligue 1 classique jouée (12 joueurs), 2 étapes du Tour");
}

/** Annuaire de démonstration : fiche d'arbitre et offre d'emploi fictives. */
async function seedDirectory() {
  const { data: arb } = await db
    .from("profiles")
    .select("id")
    .eq("phone", "+22990000005")
    .maybeSingle();
  if (!arb) return;
  const { data: existing } = await db
    .from("arbiter_profiles")
    .select("id")
    .eq("profile_id", arb.id)
    .maybeSingle();
  if (existing) {
    console.log("• Annuaire de démonstration déjà présent");
    return;
  }
  must(
    await db.from("arbiter_profiles").insert({
      profile_id: arb.id,
      title: "club",
      zone: "Littoral et Ouémé (démonstration)",
      availability: "Week-ends (démonstration)",
      languages: ["fr", "fon"],
      verified: false,
    }),
    "arbitre démo",
  );
  await db.from("profiles").update({ is_public: true }).eq("id", arb.id);
  const { data: club } = await db
    .from("organizations")
    .select("id")
    .eq("slug", "club-demo-cotonou")
    .maybeSingle();
  must(
    await db.from("job_posts").insert({
      organization_id: club?.id ?? null,
      posted_by: arb.id,
      kind: "coach",
      title: "Coach pour l'atelier jeunes du samedi (démonstration)",
      description:
        "Offre fictive servant à la démonstration de l'annuaire : animation d'un atelier d'initiation pour enfants le samedi matin.",
      city: "Cotonou",
      contract: "part_time",
      contact: "contact@demo.chesspirit.local",
      status: "published",
      is_demo: true,
    }),
    "offre démo",
  );
  console.log("✓ Annuaire de démonstration : 1 arbitre, 1 offre d'emploi");
}

const launchId = await seedLaunchTournament();
await seedShop(withDemo);

if (withDemo) {
  await seedDemo();
  await seedCoachingDemo();
  // Une partie des joueurs de démonstration inscrits au tournoi du 3 octobre ? Non : on ne mélange pas
  // données fictives et événement réel.
  void launchId;
}
await seedLeagues(withDemo);
if (withDemo) await seedDirectory();
console.log("✓ Seed terminé");
