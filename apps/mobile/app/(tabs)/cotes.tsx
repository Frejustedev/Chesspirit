import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, H2, Muted, Screen, Strong } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

const LABELS: Record<string, string> = {
  blitz: "Blitz",
  rapid: "Rapide",
  classical: "Classique",
  online: "En ligne",
};
type Mine = { type: string; rating: number; provisional: boolean; games: number };
type Top = {
  rank: number | null;
  display_name: string | null;
  rating: number | null;
  profile_id: string | null;
  is_demo: boolean | null;
};

export default function Ratings() {
  const { profile } = useSession();
  const [mine, setMine] = useState<Mine[]>([]);
  const [type, setType] = useState("rapid");
  const [top, setTop] = useState<Top[]>([]);
  const load = useCallback(async () => {
    if (profile) {
      const { data } = await supabase
        .from("ratings")
        .select("type, rating, provisional, games")
        .eq("profile_id", profile.id);
      setMine(data ?? []);
    }
    const { data: t } = await supabase
      .from("public_ratings")
      .select("rank, display_name, rating, profile_id, is_demo")
      .eq("type", type as "rapid")
      .order("rank")
      .limit(30);
    setTop(t ?? []);
  }, [profile, type]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen title="Cotes Chesspirit" onRefresh={load}>
      {profile ? (
        <>
          <H2>Mes cotes</H2>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["blitz", "rapid", "classical", "online"].map((k) => {
              const r = mine.find((m) => m.type === k);
              return (
                <View key={k} style={{ width: "48%" }}>
                  <Card>
                    <Muted>{LABELS[k]}</Muted>
                    <Text style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}>
                      {r ? r.rating : "—"}
                      {r?.provisional ? (
                        <Text style={{ fontSize: 12, color: colors.stone }}> prov.</Text>
                      ) : null}
                    </Text>
                    {r ? <Muted>{r.games} parties</Muted> : null}
                  </Card>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      <H2>Classement</H2>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {["rapid", "blitz", "classical", "online"].map((k) => (
          <Text
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: type === k }}
            onPress={() => setType(k)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: type === k ? colors.ink : "transparent",
              color: type === k ? colors.paper : colors.ink,
              borderWidth: 1,
              borderColor: colors.line,
              fontWeight: "700",
            }}
          >
            {LABELS[k]}
          </Text>
        ))}
      </View>
      {top.length === 0 ? (
        <Muted>Le classement sera publié après les premiers tournois homologués.</Muted>
      ) : null}
      {top.map((r) => (
        <View
          key={r.profile_id}
          style={{
            flexDirection: "row",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ width: 36, color: colors.stone }}>{r.rank}</Text>
          <View style={{ flex: 1 }}>
            <Strong>{r.display_name}</Strong>
            {r.is_demo ? <Muted>démonstration</Muted> : null}
          </View>
          <Text style={{ fontWeight: "700", color: colors.ink }}>{r.rating}</Text>
        </View>
      ))}
    </Screen>
  );
}
