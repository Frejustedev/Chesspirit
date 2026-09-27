import { StyleSheet } from "@react-pdf/renderer";

// Couleurs de la charte (les PDF utilisent les polices standard Times/Helvetica, toujours disponibles).
export const C = {
  ink: "#1c1815",
  paper: "#fbf8f1",
  cream: "#f6f0e3",
  gold: "#b08b3e",
  goldDeep: "#7d6128",
  bordeaux: "#6e1c2c",
  stone: "#6f655b",
  line: "#e2d8c5",
};

export const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 42,
  },
  logo: { fontFamily: "Times-Bold", fontSize: 22 },
  logoS: { fontFamily: "Times-BoldItalic", color: C.goldDeep },
  h1: { fontFamily: "Times-Bold", fontSize: 26, marginTop: 18 },
  h2: { fontFamily: "Times-Bold", fontSize: 14, marginTop: 16, marginBottom: 6 },
  muted: { color: C.stone },
  rule: { height: 3, backgroundColor: C.gold, marginVertical: 12 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    paddingVertical: 3,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.stone, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    fontSize: 8,
    color: C.stone,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
