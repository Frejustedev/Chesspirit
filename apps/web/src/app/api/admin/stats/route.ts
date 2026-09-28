import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdminRole } from "@/lib/auth";

/** Export CSV des statistiques (indicateur ; clé ; valeur) sur la période. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminRole(session.roles) || session.aal !== "aal2")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const du = req.nextUrl.searchParams.get("du") ?? "";
  const au = req.nextUrl.searchParams.get("au") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(du) || !/^\d{4}-\d{2}-\d{2}$/.test(au))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats", { p_from: du, p_to: au });
  if (error) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows: string[] = ["section;indicateur;cle;valeur"];
  const walk = (section: string, key: string, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v))
      for (const [k, x] of Object.entries(v)) {
        if (x && typeof x === "object")
          for (const [kk, xx] of Object.entries(x))
            rows.push([section, `${key}.${k}`, kk, String(xx)].join(";"));
        else rows.push([section, key, k, String(x)].join(";"));
      }
  };
  for (const [section, v] of Object.entries(data as Record<string, unknown>))
    walk(section, section, v);
  const safe = rows.map((r) => r.replace(/(^|;)([=+\-@])/g, "$1'$2"));
  return new NextResponse(`﻿${safe.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="statistiques-${du}-${au}.csv"`,
      "cache-control": "no-store",
    },
  });
}
