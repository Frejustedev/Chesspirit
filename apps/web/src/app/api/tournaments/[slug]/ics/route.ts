import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const icsDate = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** Fichier agenda (.ics) : ajout du tournoi au calendrier du téléphone. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  if (!t) return new Response("Introuvable", { status: 404 });
  const allDay = t.unconfirmed_fields.includes("schedule");
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(t.starts_at)).replace(/-/g, "");
  const next = new Date(Date.parse(`${localDay.slice(0, 4)}-${localDay.slice(4, 6)}-${localDay.slice(6)}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const start = allDay ? `DTSTART;VALUE=DATE:${localDay}` : `DTSTART:${icsDate(new Date(t.starts_at).toISOString())}`;
  const end = allDay
    ? `DTEND;VALUE=DATE:${next}`
    : `DTEND:${icsDate(new Date(t.ends_at ?? Date.parse(t.starts_at) + 8 * 3600000).toISOString())}`;
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chesspirit//FR",
    "BEGIN:VEVENT",
    `UID:${t.id}@chesspirit.com`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    start,
    end,
    `SUMMARY:${esc(t.name)}`,
    `LOCATION:${esc([t.venue, t.city].filter(Boolean).join(", "))}`,
    `URL:${env.siteUrl}/competitions/${t.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${t.slug}.ics"` },
  });
}
