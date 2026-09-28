import type { NextRequest } from "next/server";
import { Document, Image, Page, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { FORMATS, renderPoster, type PosterFormat, type PosterTemplate } from "@/lib/poster/render";

/**
 * Affiche du tournoi : ?format=a4|a3|post|story|status|banner&template=chesspirit|neutral&type=announce|results&output=png|pdf
 * Gratuite pour tous les organisateurs ; générée à la volée depuis les données publiques.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = req.nextUrl.searchParams;
  const format = (sp.get("format") ?? "a4") as PosterFormat;
  if (!(format in FORMATS)) return new Response("Format inconnu", { status: 400 });
  const template: PosterTemplate = sp.get("template") === "neutral" ? "neutral" : "chesspirit";
  const kind = sp.get("type") === "results" ? "results" : "announce";
  const supabase = await createClient();
  const { data: t } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  if (!t) return new Response("Introuvable", { status: 404 });
  const [{ data: partners }, { data: prizes }, { data: podium }] = await Promise.all([
    supabase.from("tournament_partners").select("name").eq("tournament_id", t.id).order("position"),
    supabase.from("prizes").select("label, amount_xof").eq("tournament_id", t.id).order("position"),
    supabase
      .from("public_standings")
      .select("rank, display_name, points")
      .eq("tournament_id", t.id)
      .order("rank")
      .limit(3),
  ]);
  const png = await renderPoster(
    {
      tournament: t,
      partners: (partners ?? []).map((p) => p.name),
      prizes: (prizes ?? []).map((p) => ({ label: tr(p.label, "fr"), amount: p.amount_xof })),
      podium: (podium ?? []).map((p) => ({
        rank: p.rank ?? 0,
        name: p.display_name ?? "",
        points: Number(p.points ?? 0),
      })),
    },
    format,
    template,
    kind,
  );
  const name = `affiche-${t.slug}-${format}${kind === "results" ? "-resultats" : ""}`;
  if (sp.get("output") === "pdf") {
    const buf = Buffer.from(await png.arrayBuffer());
    const { w, h } = FORMATS[format];
    const size =
      format === "a3" ? "A3" : format === "a4" ? "A4" : ([w * 0.75, h * 0.75] as [number, number]);
    const doc = createElement(
      Document,
      { title: t.name, author: "Chesspirit" },
      createElement(
        Page,
        { size, style: { padding: 0 } },
        createElement(Image, {
          src: `data:image/png;base64,${buf.toString("base64")}`,
          style: { width: "100%", height: "100%" },
        }),
      ),
    );
    const pdf = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}.pdf"`,
      },
    });
  }
  return new Response(png.body, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `inline; filename="${name}.png"`,
      "cache-control": "public, max-age=300",
    },
  });
}
