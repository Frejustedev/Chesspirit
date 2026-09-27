import { Document, Page, Text, View } from "@react-pdf/renderer";
import { s } from "./styles";

export type ReportData = {
  tournament: string;
  dates: string;
  venue: string;
  timeControl: string;
  system: string;
  rounds: number;
  chiefArbiter: string;
  deputies: string[];
  players: number;
  games: number;
  forfeits: number;
  byes: number;
  manualChanges: number;
  standings: { rank: number; name: string; points: number; tb: string; delta: number | null }[];
  demo: boolean;
  generatedOn: string;
};

/** Rapport d'arbitrage (PDF). */
export function ArbiterReport({ d }: { d: ReportData }) {
  const facts: [string, string][] = [
    ["Dates", d.dates],
    ["Lieu", d.venue || "—"],
    ["Cadence", d.timeControl || "—"],
    ["Système", d.system],
    ["Rondes", String(d.rounds)],
    ["Arbitre principal", d.chiefArbiter || "—"],
    ["Arbitres adjoints", d.deputies.join(", ") || "—"],
    ["Joueurs", String(d.players)],
    ["Parties jouées", String(d.games)],
    ["Forfaits", String(d.forfeits)],
    ["Exempts et byes", String(d.byes)],
    ["Modifications manuelles d'appariements", String(d.manualChanges)],
  ];
  return (
    <Document title={`Rapport d'arbitrage — ${d.tournament}`} author="Chesspirit" language="fr">
      <Page size="A4" style={s.page}>
        <Text style={s.logo}>
          Ches<Text style={s.logoS}>s</Text>pirit
        </Text>
        <Text style={s.h1}>Rapport d&apos;arbitrage</Text>
        <Text style={{ fontSize: 13, marginTop: 4 }}>{d.tournament}</Text>
        {d.demo ? (
          <Text style={{ marginTop: 4, color: "#6e1c2c" }}>
            Document de démonstration — données fictives
          </Text>
        ) : null}
        <View style={s.rule} />
        {facts.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={{ width: 200, color: "#6f655b" }}>{k}</Text>
            <Text style={{ flex: 1 }}>{v}</Text>
          </View>
        ))}
        <Text style={s.h2}>Classement final</Text>
        <View style={s.row}>
          <Text style={[s.th, { width: 30 }]}>Rg</Text>
          <Text style={[s.th, { flex: 1 }]}>Joueur</Text>
          <Text style={[s.th, { width: 40, textAlign: "right" }]}>Pts</Text>
          <Text style={[s.th, { width: 110, textAlign: "right" }]}>Départages</Text>
          <Text style={[s.th, { width: 45, textAlign: "right" }]}>Δ cote</Text>
        </View>
        {d.standings.map((r) => (
          <View key={r.rank + r.name} style={s.row} wrap={false}>
            <Text style={{ width: 30 }}>{r.rank}</Text>
            <Text style={{ flex: 1 }}>{r.name}</Text>
            <Text style={{ width: 40, textAlign: "right" }}>{r.points}</Text>
            <Text style={{ width: 110, textAlign: "right" }}>{r.tb}</Text>
            <Text style={{ width: 45, textAlign: "right" }}>
              {r.delta == null ? "" : `${r.delta >= 0 ? "+" : ""}${r.delta}`}
            </Text>
          </View>
        ))}
        <Text style={[s.muted, { marginTop: 24 }]}>
          Signature de l&apos;arbitre principal : ______________________
        </Text>
        <View style={s.footer} fixed>
          <Text>Généré par Chesspirit le {d.generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
