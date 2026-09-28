import { renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatTimeControl, localDate } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { loadState } from "@/lib/tournament-engine";
import { ArbiterReport } from "@/lib/pdf/report";

const SYSTEMS: Record<string, string> = {
  swiss_dutch: "Suisse (FIDE néerlandais)",
  swiss_accelerated: "Suisse accéléré",
  round_robin: "Toutes rondes",
  double_round_robin: "Toutes rondes aller-retour",
  knockout: "Élimination directe",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Requête invalide", { status: 400 });
  const supabase = await createClient();
  const { error: denied } = await supabase.rpc("log_admin_view", {
    p_object_type: "tournaments",
    p_object_id: id,
    p_context: "arbiter_report",
  });
  if (denied) return new Response("Accès refusé", { status: 403 });
  const st = await loadState(supabase, id);
  const t = st.tournament;
  const [{ data: standings }, { data: staff }, { data: changes }] = await Promise.all([
    supabase
      .from("public_standings")
      .select("rank, display_name, points, tiebreaks, rating_delta")
      .eq("tournament_id", id)
      .order("rank"),
    supabase
      .from("tournament_staff")
      .select("role, profiles(first_name, last_name)")
      .eq("tournament_id", id),
    supabase
      .from("tournament_audit")
      .select("id")
      .eq("tournament_id", id)
      .eq("action", "edit_pairing"),
  ]);
  const name = (p: { first_name: string; last_name: string } | null) =>
    p ? `${p.first_name} ${p.last_name}` : "";
  const main = st.pairings.filter((p) => p.stage === "main");
  const pdf = await renderToBuffer(
    ArbiterReport({
      d: {
        tournament: t.name,
        dates:
          formatDate(t.starts_at, "fr") +
          (t.ends_at && localDate(t.ends_at) !== localDate(t.starts_at)
            ? ` – ${formatDate(t.ends_at, "fr")}`
            : ""),
        venue: [t.venue, t.city].filter(Boolean).join(", "),
        timeControl: t.base_minutes
          ? formatTimeControl({
              baseMinutes: t.base_minutes,
              incrementSeconds: t.increment_seconds ?? 0,
            })
          : "",
        // Rondes appariées sans le moteur FIDE (service échecs absent) : le rapport le dit.
        system:
          (SYSTEMS[t.pairing_system] ?? t.pairing_system) +
          (st.rounds.some((r) => r.pairing_engine === "fallback")
            ? " — appariement de secours (non homologué)"
            : ""),
        rounds: st.rounds.length,
        chiefArbiter: name((staff ?? []).find((x) => x.role === "chief_arbiter")?.profiles ?? null),
        deputies: (staff ?? [])
          .filter((x) => x.role === "deputy_arbiter")
          .map((x) => name(x.profiles)),
        players: st.participants.length,
        games: main.filter((p) => p.black_id && ["1-0", "0-1", "1/2-1/2"].includes(p.result ?? ""))
          .length,
        forfeits: main.filter((p) => ["+-", "-+", "0-0"].includes(p.result ?? "")).length,
        byes: main.filter((p) => !p.black_id).length,
        manualChanges: changes?.length ?? 0,
        standings: (standings ?? []).map((r) => {
          const tb = (r.tiebreaks ?? {}) as Record<string, number>;
          return {
            rank: r.rank ?? 0,
            name: r.display_name ?? "",
            points: Number(r.points ?? 0),
            tb: t.tiebreaks
              .slice(0, 3)
              .map((k) => tb[k] ?? "")
              .join(" / "),
            delta: r.rating_delta,
          };
        }),
        demo: t.is_demo,
        generatedOn: formatDate(new Date(), "fr"),
      },
    }),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="rapport-arbitrage-${t.slug}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
