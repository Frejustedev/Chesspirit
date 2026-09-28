/**
 * Crée (ou promeut) le premier compte super-administrateur.
 *
 *   pnpm create-admin --email vous@exemple.com --phone +22901XXXXXXXX --first Prénom --last Nom
 *
 * Variables : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.
 * À la première connexion, la double authentification (application TOTP) sera demandée.
 * Rejouable sans risque : un compte existant est simplement promu.
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    phone: { type: "string" },
    first: { type: "string" },
    last: { type: "string" },
  },
});
// GoTrue enregistre les adresses en minuscules : même forme pour la recherche et la création.
const email = values.email?.trim().toLowerCase();
if (!email && !values.phone) {
  console.error("Usage : pnpm create-admin --email … [--phone +229…] [--first Prénom --last Nom]");
  process.exit(1);
}
if (values.phone && !/^\+[1-9]\d{7,14}$/.test(values.phone)) {
  console.error("Numéro invalide : format international attendu, par exemple +2290197000000");
  process.exit(1);
}
const url =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  (/localhost|127\.0\.0\.1/.test(url)
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    : "");
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY manquante");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const phoneDigits = values.phone?.replace(/^\+/, "");
let user = list.users.find(
  (u) => (email && u.email?.toLowerCase() === email) || (phoneDigits && u.phone === phoneDigits),
);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    phone: values.phone,
    email_confirm: !!email,
    phone_confirm: !!values.phone,
  });
  if (error) throw error;
  user = data.user!;
  console.log(`✓ Compte créé : ${user.id}`);
} else {
  console.log(`• Compte existant : ${user.id}`);
}
const { error: roleErr } = await db
  .from("user_roles")
  .upsert(
    { user_id: user.id, role: "super_admin" },
    { onConflict: "user_id,role,scope_id", ignoreDuplicates: true },
  );
if (roleErr) throw roleErr;
const { data: profile } = await db
  .from("profiles")
  .select("id")
  .eq("user_id", user.id)
  .maybeSingle();
if (!profile && values.first && values.last) {
  const { error: profileErr } = await db.from("profiles").insert({
    user_id: user.id,
    first_name: values.first,
    last_name: values.last,
    email: email ?? null,
    phone: values.phone ?? null,
    source: "signup",
  });
  if (profileErr) throw profileErr;
}
console.log(
  "✓ Rôle super_admin attribué. Connectez-vous sur /connexion puis activez la double authentification.",
);
