import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { C, s } from "./styles";

export type CertificateData = {
  player: string;
  tournament: string;
  date: string;
  venue: string;
  cadence: string;
  rank: number | null;
  points: number | null;
  participants: number;
  verifyUrl: string;
  qrDataUrl: string;
  issuedOn: string;
  demo: boolean;
};

export function Certificate({ d }: { d: CertificateData }) {
  return (
    <Document title={`Attestation — ${d.player}`} author="Chesspirit" language="fr">
      <Page size="A4" orientation="landscape" style={[s.page, { padding: 0 }]}>
        <View style={{ margin: 22, flex: 1, borderWidth: 2, borderColor: C.ink, padding: 34 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Text style={s.logo}>
              Ches<Text style={s.logoS}>s</Text>pirit
            </Text>
            <Text style={[s.muted, { fontSize: 9 }]}>chesspirit.com</Text>
          </View>
          <View style={{ alignItems: "center", marginTop: 30 }}>
            <Text style={{ fontSize: 10, letterSpacing: 3, color: C.goldDeep }}>
              ATTESTATION DE PARTICIPATION
            </Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 13, marginTop: 26 }}>
              Chesspirit atteste que
            </Text>
            <Text style={{ fontFamily: "Times-Bold", fontSize: 34, marginTop: 10 }}>
              {d.player}
            </Text>
            <Text
              style={{
                fontFamily: "Times-Roman",
                fontSize: 13,
                marginTop: 14,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              a participé au tournoi « {d.tournament} » ({d.cadence}), le {d.date}
              {d.venue ? ` à ${d.venue}` : ""}
              {d.rank
                ? `, et s'est classé(e) ${d.rank}${d.rank === 1 ? "er" : "e"} sur ${d.participants} avec ${d.points} point${(d.points ?? 0) > 1 ? "s" : ""}`
                : ""}
              .
            </Text>
            {d.demo ? (
              <Text style={{ marginTop: 12, color: C.bordeaux }}>
                Document de démonstration — données fictives
              </Text>
            ) : null}
          </View>
          <View
            style={{
              position: "absolute",
              left: 34,
              right: 34,
              bottom: 30,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View>
              <Text style={s.muted}>Délivrée le {d.issuedOn}</Text>
              <Text style={[s.muted, { marginTop: 18 }]}>
                Pour l&apos;organisation : ______________________
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas une image HTML */}
              <Image src={d.qrDataUrl} style={{ width: 70, height: 70 }} />
              <Text style={{ fontSize: 7, color: C.stone, marginTop: 3 }}>
                Vérifier : {d.verifyUrl.replace(/^https?:\/\//, "")}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
