import { createClient } from "@/lib/supabase/server";

/** Export de ses données personnelles (droit d'accès et de portabilité), au format JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const { data: profiles } = await supabase.from("profiles").select("*");
  const ids = (profiles ?? []).map((p) => p.id);
  const [consents, registrations, payments, ratings, notifications] = await Promise.all([
    supabase.from("consents").select("*").in("profile_id", ids),
    supabase.from("registrations").select("*").in("player_id", ids),
    supabase.from("payments").select("id, provider, amount_xof, status, object_type, created_at, confirmed_at"),
    supabase.from("ratings").select("*").in("profile_id", ids),
    supabase.from("notifications").select("*").in("profile_id", ids),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, phone: user.phone, created_at: user.created_at },
    profiles,
    consents: consents.data,
    registrations: registrations.data,
    payments: payments.data,
    ratings: ratings.data,
    notifications: notifications.data,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="chesspirit-mes-donnees.json"`,
      "cache-control": "no-store",
    },
  });
}
