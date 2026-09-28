import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { formatDate } from "@chesspirit/shared";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Certificate } from "@/lib/pdf/certificate";

const CADENCE: Record<string, string> = {
  blitz: "cadence blitz",
  rapid: "cadence rapide",
  classical: "cadence classique",
};

/** Attestation de participation en PDF (joueur, parent ou staff ; tournoi terminé). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const { registrationId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(registrationId))
    return new Response("Requête invalide", { status: 400 });
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("registrations")
    .select(
      "id, ticket_code, player_id, tournament_id, profiles!registrations_player_id_fkey(first_name, last_name), tournaments(name, starts_at, venue, city, cadence, status, is_demo)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!r?.tournaments || !r.profiles) return new Response("Introuvable", { status: 404 });
  if (!["ongoing", "finished", "archived"].includes(r.tournaments.status))
    return new Response("Tournoi non terminé", { status: 409 });
  const [{ data: st }, { count }] = await Promise.all([
    supabase
      .from("public_standings")
      .select("rank, points")
      .eq("tournament_id", r.tournament_id)
      .eq("player_id", r.player_id)
      .maybeSingle(),
    supabase
      .from("public_standings")
      .select("player_id", { count: "exact", head: true })
      .eq("tournament_id", r.tournament_id),
  ]);
  const verifyUrl = `${env.siteUrl}/billet/${r.ticket_code}`;
  const pdf = await renderToBuffer(
    Certificate({
      d: {
        player: `${r.profiles.first_name} ${r.profiles.last_name}`,
        tournament: r.tournaments.name,
        date: formatDate(r.tournaments.starts_at, "fr"),
        venue: [r.tournaments.venue, r.tournaments.city].filter(Boolean).join(", "),
        cadence: CADENCE[r.tournaments.cadence ?? ""] ?? "",
        rank: st?.rank ?? null,
        points: st?.points != null ? Number(st.points) : null,
        participants: count ?? 0,
        verifyUrl,
        qrDataUrl: await QRCode.toDataURL(verifyUrl, {
          margin: 0,
          color: { dark: "#1c1815", light: "#fbf8f1" },
        }),
        issuedOn: formatDate(new Date(), "fr"),
        demo: r.tournaments.is_demo,
      },
    }),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="attestation-${r.ticket_code}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
