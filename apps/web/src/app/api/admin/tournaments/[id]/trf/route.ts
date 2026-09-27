import { exportTrf, type TrfRound } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { loadState } from "@/lib/tournament-engine";

/** Export TRF (FIDE) du tournoi pour l'homologation ou Swiss Manager. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Requête invalide", { status: 400 });
  const supabase = await createClient();
  const { error: denied } = await supabase.rpc("log_admin_view", {
    p_object_type: "tournaments",
    p_object_id: id,
    p_context: "trf_export",
  });
  if (denied) return new Response("Accès refusé", { status: 403 });
  const st = await loadState(supabase, id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, sex, birth_date, fide_id, titles")
    .in(
      "id",
      st.participants.map((p) => p.playerId),
    );
  const { data: standings } = await supabase
    .from("standings")
    .select("player_id, rank, points")
    .eq("tournament_id", id);
  const { data: staff } = await supabase
    .from("tournament_staff")
    .select("role, profiles(first_name, last_name)")
    .eq("tournament_id", id)
    .eq("role", "chief_arbiter")
    .maybeSingle();
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const stand = new Map((standings ?? []).map((s) => [s.player_id, s]));
  const start = new Map(st.participants.map((p) => [p.playerId, p.startNo]));
  const roundNo = new Map(st.rounds.map((r) => [r.id, r.number]));
  const t = st.tournament;
  const d = (iso: string) => iso.slice(0, 10).replace(/-/g, "/");

  const players = st.participants.map((p) => {
    const rounds: TrfRound[] = st.rounds.map((r) => {
      const pr = st.pairings.find(
        (x) =>
          x.round_id === r.id &&
          x.stage === "main" &&
          (x.white_id === p.playerId || x.black_id === p.playerId),
      );
      if (!pr) return { opponent: null, color: "-", result: "Z" };
      if (!pr.black_id)
        return {
          opponent: null,
          color: "-",
          result: pr.bye_type === "half" ? "H" : pr.bye_type === "zero" ? "Z" : "U",
        };
      const white = pr.white_id === p.playerId;
      const res = pr.result ?? "";
      const map: Record<string, [TrfRound["result"], TrfRound["result"]]> = {
        "1-0": ["1", "0"],
        "0-1": ["0", "1"],
        "1/2-1/2": ["=", "="],
        "+-": ["+", "-"],
        "-+": ["-", "+"],
        "=-=": ["=", "="],
        "0-0": ["-", "-"],
      };
      const [rw, rb] = map[res] ?? [" ", " "];
      return {
        opponent: start.get(white ? pr.black_id : pr.white_id) ?? null,
        color: white ? "w" : "b",
        result: white ? rw : rb,
      };
    });
    void roundNo;
    const pf = prof.get(p.playerId);
    const s = stand.get(p.playerId);
    return {
      startNo: p.startNo,
      sex: (pf?.sex === "F" ? "w" : pf?.sex === "M" ? "m" : " ") as "m" | "w" | " ",
      title: pf?.titles?.[0] ?? "",
      name: p.trfName,
      rating: p.rating || null,
      federation: "BEN",
      fideId: pf?.fide_id ?? null,
      birthDate: pf?.birth_date ? d(pf.birth_date) : null,
      points: Number(s?.points ?? 0),
      rank: s?.rank ?? p.startNo,
      rounds,
    };
  });
  const body = exportTrf(
    {
      name: t.name,
      city: t.city ?? "",
      federation: "BEN",
      startDate: d(t.starts_at),
      endDate: d(t.ends_at ?? t.starts_at),
      chiefArbiter: staff?.profiles
        ? `${staff.profiles.last_name}, ${staff.profiles.first_name}`
        : "",
      timeControl: t.base_minutes ? `${t.base_minutes}'+${t.increment_seconds ?? 0}"` : "",
      rounds: st.rounds.length,
      roundDates: st.rounds.map(() => d(t.starts_at).slice(2)),
    },
    players,
  );
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${t.slug}.trf"`,
    },
  });
}
