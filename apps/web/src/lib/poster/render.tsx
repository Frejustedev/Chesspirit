import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { formatDate, formatTimeControl, formatXof } from "@chesspirit/shared";
import type { Tables } from "@/lib/supabase/types";
import { env } from "@/lib/env";

export const FORMATS = {
  a4: { w: 1240, h: 1754, label: "A4" },
  a3: { w: 1754, h: 2480, label: "A3" },
  post: { w: 1080, h: 1080, label: "Instagram (post)" },
  story: { w: 1080, h: 1920, label: "Instagram (story)" },
  status: { w: 1080, h: 1920, label: "Statut WhatsApp" },
  banner: { w: 1640, h: 624, label: "Bannière Facebook" },
} as const;
export type PosterFormat = keyof typeof FORMATS;
export type PosterTemplate = "chesspirit" | "neutral";

const C = {
  ink: "#1c1815",
  paper: "#fbf8f1",
  cream: "#f6f0e3",
  gold: "#b08b3e",
  goldSoft: "#e9dcc0",
  bordeaux: "#6e1c2c",
  stone: "#6f655b",
};
const KNIGHT =
  "M14.2 35.5c.2-4.8 2.3-8.1 5.4-10.9-2.6.5-5 1.5-6.6 2.9-1.7 1-3.6-.2-3.4-2 .5-3.6 2.4-6.7 5.1-9.4l.9-4.9 2.8 2.6c.9-.3 1.9-.5 2.9-.6L23.9 9l1.6 3.7c5.7 2.1 9.3 7.7 9.3 14.6 0 3-.4 5.7-1 8.2H14.2ZM11 40.5h23a1.5 1.5 0 0 0 1.5-1.5v-1.2a2.3 2.3 0 0 0-2.3-2.3H11.8a2.3 2.3 0 0 0-2.3 2.3V39a1.5 1.5 0 0 0 1.5 1.5Z";

// Polices copiées dans assets/fonts (licence SIL OFL 1.1), lues par des chemins littéraux : le traçage des
// fichiers de Next.js les embarque ainsi dans la fonction déployée, ce qui n'était pas le cas depuis node_modules.
async function fonts() {
  const [fraunces700, fraunces600, sans400, sans600] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "assets/fonts/fraunces-latin-700-normal.woff")),
    fs.readFile(path.join(process.cwd(), "assets/fonts/fraunces-latin-600-normal.woff")),
    fs.readFile(path.join(process.cwd(), "assets/fonts/source-sans-3-latin-400-normal.woff")),
    fs.readFile(path.join(process.cwd(), "assets/fonts/source-sans-3-latin-600-normal.woff")),
  ]);
  return [
    { name: "Fraunces", data: fraunces700, weight: 700 as const, style: "normal" as const },
    { name: "Fraunces", data: fraunces600, weight: 600 as const, style: "normal" as const },
    { name: "Sans", data: sans400, weight: 400 as const, style: "normal" as const },
    { name: "Sans", data: sans600, weight: 600 as const, style: "normal" as const },
  ];
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export type PosterData = {
  tournament: Tables<"tournaments">;
  partners: string[];
  prizes: { label: string; amount: number | null }[];
  podium: { rank: number; name: string; points: number }[];
};

/** Affiche générée depuis les données du tournoi : seules les informations confirmées apparaissent. */
export async function renderPoster(
  d: PosterData,
  format: PosterFormat,
  template: PosterTemplate,
  kind: "announce" | "results",
) {
  const { w, h } = FORMATS[format];
  const t = d.tournament;
  const brand = template === "chesspirit";
  const bg = brand ? C.ink : C.paper;
  const fg = brand ? C.cream : C.ink;
  const accent = brand ? C.gold : C.bordeaux;
  const u = Math.min(w, h) / 100; // unité relative
  const wide = w / h > 1.8;
  const square = !wide && w / h > 0.9;
  const longName = t.name.length > 24;
  const titleSize = u * (wide ? 11 : square ? 7.5 : 11) * (longName ? 0.78 : 1);
  const tbc = (f: string) => t.unconfirmed_fields.includes(f);
  const date = formatDate(t.starts_at, "fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = tbc("schedule") ? null : formatDate(t.starts_at, "fr", { timeStyle: "short" });
  const facts: string[] = [];
  const cad = t.cadence
    ? { blitz: "Blitz", rapid: "Rapide", classical: "Classique" }[t.cadence]
    : null;
  if (cad)
    facts.push(
      !tbc("time_control") && t.base_minutes
        ? `${cad} · ${formatTimeControl({ baseMinutes: t.base_minutes, incrementSeconds: t.increment_seconds ?? 0 })}`
        : cad,
    );
  if (!tbc("rounds") && t.rounds_count) facts.push(`${t.rounds_count} rondes`);
  if (!tbc("fee") && t.entry_fee_xof != null)
    facts.push(
      t.entry_fee_xof === 0 ? "Entrée gratuite" : `Inscription ${formatXof(t.entry_fee_xof)}`,
    );
  const prizes = tbc("prizes") ? [] : d.prizes.slice(0, 4);
  const url = `${env.siteUrl.replace(/^https?:\/\//, "")}/competitions/${t.slug}`;
  const qr = await QRCode.toString(
    `${env.siteUrl}/competitions/${t.slug}${kind === "announce" ? "/inscription" : "/resultats"}`,
    {
      type: "svg",
      margin: 1,
      color: { dark: C.ink, light: brand ? C.cream : "#ffffff" },
    },
  );
  const knight = svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path d="${KNIGHT}" fill="none" stroke="${accent}" stroke-width="0.45" stroke-linejoin="round"/></svg>`,
  );

  const title = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Sans",
          fontWeight: 600,
          fontSize: u * (wide ? 5.5 : 3.2),
          letterSpacing: u * 0.4,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {kind === "results"
          ? "Résultats"
          : t.edition
            ? `Tournoi · ${t.edition}`
            : "Tournoi d'échecs"}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Fraunces",
          fontWeight: 700,
          fontSize: titleSize,
          lineHeight: 1.02,
          marginTop: u * 1.5,
          color: fg,
        }}
      >
        {t.name}
      </div>
    </div>
  );

  const infos = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Sans",
        fontSize: u * (wide ? 5 : 3.4),
        color: fg,
        marginTop: u * 3,
      }}
    >
      <div style={{ display: "flex", fontWeight: 600 }}>
        {date.charAt(0).toUpperCase() + date.slice(1) + (time ? ` · ${time}` : "")}
      </div>
      {t.venue ? (
        <div style={{ display: "flex", marginTop: u * 0.8 }}>
          {[t.venue, t.city].filter(Boolean).join(", ")}
        </div>
      ) : null}
      {facts.length && kind === "announce" ? (
        <div style={{ display: "flex", marginTop: u * 0.8, color: brand ? C.goldSoft : C.stone }}>
          {facts.join("  ·  ")}
        </div>
      ) : null}
    </div>
  );

  const body =
    kind === "results" ? (
      <div style={{ display: "flex", flexDirection: "column", marginTop: u * 4, gap: u * 1.5 }}>
        {d.podium.map((p) => (
          <div
            key={p.rank}
            style={{
              display: "flex",
              alignItems: "baseline",
              fontFamily: "Fraunces",
              fontSize: u * (square ? (p.rank === 1 ? 5.2 : 4.2) : p.rank === 1 ? 7 : 5.2),
              color: fg,
            }}
          >
            <div style={{ display: "flex", width: u * 9, color: accent }}>{p.rank}.</div>
            <div style={{ display: "flex", flex: 1 }}>{p.name}</div>
            <div
              style={{
                display: "flex",
                fontFamily: "Sans",
                fontSize: u * 3.6,
                color: brand ? C.goldSoft : C.stone,
              }}
            >
              {p.points} pts
            </div>
          </div>
        ))}
      </div>
    ) : prizes.length ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: u * 4,
          fontFamily: "Sans",
          fontSize: u * 3.2,
          color: fg,
        }}
      >
        <div
          style={{
            display: "flex",
            color: accent,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: u * 0.3,
          }}
        >
          Dotations
        </div>
        {prizes.map((p) => (
          <div key={p.label} style={{ display: "flex", marginTop: u * 0.6 }}>
            {p.label}
            {p.amount != null ? ` — ${formatXof(p.amount)}` : ""}
          </div>
        ))}
      </div>
    ) : null;

  const footer = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Sans",
          fontSize: u * 2.6,
          color: brand ? C.goldSoft : C.stone,
          maxWidth: "62%",
        }}
      >
        {d.partners.length ? (
          <div style={{ display: "flex" }}>{`Avec ${d.partners.join(" · ")}`}</div>
        ) : null}
        <div
          style={{
            display: "flex",
            marginTop: u * 0.8,
            fontFamily: "Fraunces",
            fontWeight: 700,
            fontSize: u * (brand ? 5 : 3),
            color: fg,
          }}
        >
          {brand ? "Ches" : "chesspirit.com"}
          {brand ? <span style={{ color: C.gold }}>s</span> : null}
          {brand ? "pirit" : null}
        </div>
        {brand ? <div style={{ display: "flex", fontSize: u * 2.2 }}>{url}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendu Satori */}
        <img
          src={svgUri(qr)}
          width={u * (wide ? 30 : square ? 15 : 18)}
          height={u * (wide ? 30 : square ? 15 : 18)}
          alt=""
        />
        <div
          style={{
            display: "flex",
            fontFamily: "Sans",
            fontSize: u * 1.8,
            marginTop: u * 0.6,
            color: brand ? C.goldSoft : C.stone,
          }}
        >
          {kind === "announce" ? "Inscription en ligne" : "Classement complet"}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: bg,
        position: "relative",
        padding: u * 6,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu Satori */}
      <img
        src={knight}
        alt=""
        style={{
          position: "absolute",
          right: -u * 10,
          bottom: -u * 4,
          width: Math.min(w, h) * 0.95,
          height: Math.min(w, h) * 0.95,
          opacity: brand ? 0.18 : 0.1,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          border: brand ? "none" : `${u * 0.4}px solid ${C.ink}`,
          padding: brand ? 0 : u * 4,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {title}
          {infos}
          {body}
          {t.is_demo ? (
            <div
              style={{
                display: "flex",
                marginTop: u * 2,
                fontFamily: "Sans",
                fontSize: u * 2.4,
                color: C.bordeaux,
              }}
            >
              Démonstration — données fictives
            </div>
          ) : null}
        </div>
        {footer}
      </div>
    </div>,
    { width: w, height: h, fonts: await fonts() },
  );
}
