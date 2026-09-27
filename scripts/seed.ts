/**
 * Données initiales.
 *   pnpm seed            → tournoi du 3 octobre 2026 (faits connus) + données de démonstration
 *   pnpm seed --no-demo  → uniquement le tournoi du 3 octobre (à utiliser en production)
 * Les données de démonstration sont fictives et marquées is_demo = true.
 */
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { computeStandings, type PairingInput, type ResultCode, buildPgn } from "@chesspirit/shared";

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
  throw new Error("Refus : données de démonstration sur une base distante. Utilisez --no-demo (ou --force-demo).");
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
  const existing = must(await db.from("tournaments").select("id").eq("slug", slug).maybeSingle(), "lecture tournoi");
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
        unconfirmed_fields: ["schedule", "time_control", "rounds", "pairing_system", "fee", "prizes", "capacity", "rated"],
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
  must(await db.from("registration_forms").insert({ tournament_id: t.id, fields: [] }), "formulaire");
  console.log("✓ Tournoi du 3 octobre 2026 créé (faits connus uniquement)");
  return t.id as string;
}

// ---------------------------------------------------------------------------
// 2. Démonstration
// ---------------------------------------------------------------------------
const FIRST_M = ["Koffi", "Sèdjro", "Rodrigue", "Ulrich", "Gildas", "Arnaud", "Fiacre", "Hervé", "Romaric", "Mahougnon", "Brice", "Landry", "Elvis", "Codjo", "Serge", "Aurel", "Parfait", "Crépin", "Jonas", "Ismaël"];
const FIRST_F = ["Aïcha", "Nadège", "Sênami", "Grâce", "Mireille", "Rachida", "Ornella", "Fifamè", "Carine", "Estelle", "Mariam", "Prudence"];
const LAST = ["Adjovi", "Houngbédji", "Dossou", "Agossou", "Tossou", "Zinsou", "Akpovi", "Gbaguidi", "Hounkpatin", "Kiki", "Sossa", "Amoussou", "Ahouandjinou", "Fagla", "Lokossou", "Dansou", "Quenum", "Yessoufou", "Bio", "Sanni"];
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
      s: (m.captured ? values[m.captured]! * 3 - values[m.piece]! : 0) + (m.san.includes("+") ? 2 : 0) + (i < 8 && "pn".includes(m.piece) ? 1.5 : 0) + rand() * 3,
    }));
    scored.sort((a, b) => b.s - a.s);
    g.move(scored[Math.floor(rand() * Math.min(3, scored.length))]!.m);
  }
  return g;
}

async function seedDemo() {
  const existing = must(await db.from("tournaments").select("id").eq("slug", "open-demo-cotonou").maybeSingle(), "lecture démo");
  if (existing) {
    console.log("• Données de démonstration déjà présentes");
    return;
  }

  // Structures
  const orgs = must(
    await db
      .from("organizations")
      .insert([
        { type: "club", name: "Club démo de Cotonou", slug: "club-demo-cotonou", city: "Cotonou", department: "Littoral", lat: 6.3654, lng: 2.4183, is_demo: true, verified: true },
        { type: "club", name: "Échiquier démo de Porto-Novo", slug: "echiquier-demo-porto-novo", city: "Porto-Novo", department: "Ouémé", lat: 6.4969, lng: 2.6289, is_demo: true, verified: false },
        { type: "school", name: "École d'échecs démo de Parakou", slug: "ecole-demo-parakou", city: "Parakou", department: "Borgou", lat: 9.3372, lng: 2.6303, is_demo: true, verified: false },
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
  const inserted = must(await db.from("profiles").insert(rows).select("id, first_name, last_name, sex, is_minor"), "joueurs");
  // Les mineurs de démonstration restent en profil réduit ; on rend public uniquement les adultes.
  inserted.forEach((p, i) => {
    const rating = Math.round(2150 - i * 26 + (rand() - 0.5) * 60);
    players.push({ id: p.id, name: `${p.first_name} ${p.last_name}`, rating, sex: p.sex as "M" | "F" });
  });

  must(
    await db.from("ratings").insert(
      players.flatMap((p) => [
        { profile_id: p.id, type: "rapid", rating: p.rating, games: 30 + Math.floor(rand() * 40), provisional: false, peak: p.rating + 20 },
        { profile_id: p.id, type: "blitz", rating: p.rating - 40 + Math.round(rand() * 80), games: 40, provisional: false, peak: p.rating + 30 },
        { profile_id: p.id, type: "classical", rating: p.rating + 15, games: 12, provisional: rand() < 0.2, peak: p.rating + 15 },
      ]),
    ),
    "cotes",
  );

  // Comptes de démonstration
  const playerUser = await ensureUser("joueur@demo.chesspirit.local", "+22990000001");
  const adminUser = await ensureUser("admin@demo.chesspirit.local", "+22990000009");
  const arbiterUser = await ensureUser("arbitre@demo.chesspirit.local", "+22990000005");
  must(await db.from("profiles").update({ user_id: playerUser, phone: "+22990000001", email: "joueur@demo.chesspirit.local", claimed: true }).eq("id", players[7]!.id), "compte joueur");
  must(
    await db.from("profiles").insert([
      { user_id: adminUser, first_name: "Admin", last_name: "Démo", birth_date: "1988-04-12", sex: "F", city: "Cotonou", department: "Littoral", source: "demo", is_demo: true, onboarded: true, phone: "+22990000009" },
      { user_id: arbiterUser, first_name: "Arbitre", last_name: "Démo", birth_date: "1979-09-30", sex: "M", city: "Cotonou", department: "Littoral", source: "demo", is_demo: true, onboarded: true, phone: "+22990000005" },
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
        summary: { fr: "Tournoi fictif servant à la démonstration.", en: "Fictitious tournament used for demonstration." },
        description: { fr: "Tournoi fictif : joueurs, résultats et parties sont générés automatiquement.", en: "Fictitious tournament: players, results and games are generated." },
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
      field.map((p) => ({ tournament_id: t.id, player_id: p.id, status: "confirmed", payment_status: "paid", payment_method: "on_site", amount_xof: 2000, seed_rating: p.rating, checked_in_at: "2026-06-13T07:45:00Z", source: "admin" })),
    ),
    "inscriptions démo",
  );

  const score = new Map(field.map((p) => [p.id, 0]));
  const met = new Set<string>();
  const pairings: PairingInput[] = [];
  const games: Record<string, unknown>[] = [];
  for (let r = 1; r <= 5; r++) {
    const round = must(await db.from("rounds").insert({ tournament_id: t.id, number: r, status: "finished", published_at: "2026-06-13T08:00:00Z" }).select("id").single(), "ronde");
    const order = [...field].sort((a, b) => score.get(b.id)! - score.get(a.id)! || b.rating - a.rating);
    const board: [typeof field[number], typeof field[number]][] = [];
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
      prs.push({ tournament_id: t.id, round_id: round.id, board: i + 1, white_id: w.id, black_id: b.id, result });
      const g = randomGame(40 + Math.floor(rand() * 50));
      const moves = g.pgn().replace(/\[.*\]\s*/g, "").trim();
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
          { Event: "Open de démonstration de Cotonou", Site: "Cotonou BEN", Date: "2026.06.13", Round: String(r), White: w.name, Black: b.name, Result: gameResult, WhiteElo: String(w.rating), BlackElo: String(b.rating), Annotator: "Chesspirit (démonstration)" },
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
      standings.map((s) => ({ tournament_id: t.id, player_id: s.playerId, rank: s.rank, points: s.points, games: s.games, tiebreaks: s.tiebreaks, performance: s.tiebreaks.performance, rating_before: s.rating, is_final: true })),
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
        summary: { fr: "Tournoi fictif pour tester l'inscription et le paiement.", en: "Fictitious tournament to test registration and payment." },
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
        { key: "tshirt", label: { fr: "Taille de t-shirt", en: "T-shirt size" }, type: "select", required: false, options: ["S", "M", "L", "XL"] },
        { key: "meal", label: { fr: "Repas sur place", en: "Meal on site" }, type: "checkbox", required: false },
      ],
    }),
    "formulaire blitz",
  );
  must(
    await db.from("tournament_staff").insert({
      tournament_id: blitz.id,
      profile_id: must(await db.from("profiles").select("id").eq("user_id", arbiterUser).single(), "profil arbitre").id,
      role: "chief_arbiter",
    }),
    "arbitre",
  );
  console.log(`✓ Démonstration : ${players.length} joueurs, 3 structures, 2 tournois, ${games.length} parties`);
  console.log("  Comptes : joueur@demo.chesspirit.local (+22990000001), arbitre@demo.chesspirit.local, admin@demo.chesspirit.local (super_admin, 2FA requise)");
}

const launchId = await seedLaunchTournament();
if (withDemo) {
  await seedDemo();
  // Une partie des joueurs de démonstration inscrits au tournoi du 3 octobre ? Non : on ne mélange pas
  // données fictives et événement réel.
  void launchId;
}
console.log("✓ Seed terminé");
