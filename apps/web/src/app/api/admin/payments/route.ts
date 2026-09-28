import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdminRole } from "@/lib/auth";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Échappement CSV et neutralisation des formules de tableur.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Export CSV des paiements (administrateurs ; droits vérifiés par la RLS). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminRole(session.roles) || session.aal !== "aal2")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "id, created_at, confirmed_at, provider, provider_ref, status, amount_xof, object_type, object_id, description",
    )
    .order("created_at", { ascending: false })
    .limit(10000);
  const statut = req.nextUrl.searchParams.get("statut");
  const type = req.nextUrl.searchParams.get("type");
  if (statut && /^[a-z_]{3,20}$/.test(statut)) q = q.eq("status", statut);
  if (type && /^[a-z_]{3,20}$/.test(type)) q = q.eq("object_type", type);
  const { data } = await q;
  await supabase.rpc("log_admin_view", {
    p_object_type: "payments",
    p_object_id: "export",
    p_context: "export CSV",
  });
  const cols = [
    "id",
    "created_at",
    "confirmed_at",
    "provider",
    "provider_ref",
    "status",
    "amount_xof",
    "object_type",
    "object_id",
    "description",
  ] as const;
  const lines = [cols.join(";"), ...(data ?? []).map((r) => cols.map((c) => esc(r[c])).join(";"))];
  return new NextResponse(`﻿${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paiements-chesspirit.csv"`,
      "cache-control": "no-store",
    },
  });
}
