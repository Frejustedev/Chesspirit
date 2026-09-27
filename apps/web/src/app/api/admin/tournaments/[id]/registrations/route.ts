import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";

/** Export CSV des inscrits (staff du tournoi ou administrateur ; RLS appliquée, consultation journalisée). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Requête invalide", { status: 400 });
  const supabase = await createClient();
  const { error: logError } = await supabase.rpc("log_admin_view", {
    p_object_type: "tournaments",
    p_object_id: id,
    p_context: "registrations_csv",
  });
  if (logError) return new Response("Accès refusé", { status: 403 });
  const { data: t } = await supabase.from("tournaments").select("slug").eq("id", id).single();
  const { data } = await supabase
    .from("registrations")
    .select(
      "status, payment_status, payment_method, amount_xof, seed_rating, checked_in_at, ticket_code, answers, created_at, profiles!registrations_player_id_fkey(last_name, first_name, sex, birth_date, phone, email, city, club_name, fide_id)",
    )
    .eq("tournament_id", id)
    .order("created_at");
  const rows = (data ?? []).map((r) => ({
    nom: r.profiles?.last_name,
    prenom: r.profiles?.first_name,
    sexe: r.profiles?.sex,
    naissance: r.profiles?.birth_date,
    telephone: r.profiles?.phone,
    email: r.profiles?.email,
    ville: r.profiles?.city,
    club: r.profiles?.club_name,
    fide_id: r.profiles?.fide_id,
    cote: r.seed_rating,
    statut: r.status,
    paiement: r.payment_status,
    moyen: r.payment_method,
    montant_xof: r.amount_xof,
    pointe_le: r.checked_in_at,
    billet: r.ticket_code,
    inscrit_le: r.created_at,
    ...Object.fromEntries(
      Object.entries((r.answers ?? {}) as Record<string, unknown>).map(([k, v]) => [
        `champ_${k}`,
        v,
      ]),
    ),
  }));
  // BOM pour une ouverture correcte des accents dans Excel ; « ; » est le séparateur attendu en français.
  const csv = "\uFEFF" + Papa.unparse(rows, { delimiter: ";" });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inscrits-${t?.slug ?? id}.csv"`,
      "cache-control": "no-store",
    },
  });
}
