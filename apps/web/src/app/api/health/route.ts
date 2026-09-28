import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** État du service pour la supervision (disponibilité) : base joignable. Aucune donnée renvoyée. */
export async function GET() {
  const started = Date.now();
  const { error } = await createAdminClient()
    .from("feature_flags")
    .select("key", { head: true, count: "exact" });
  const body = {
    status: error ? "degraded" : "ok",
    database: error ? "error" : "ok",
    ms: Date.now() - started,
  };
  return NextResponse.json(body, {
    status: error ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
