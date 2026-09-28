import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Card, Loading, Muted, Screen, Strong } from "@/components/ui";
import { supabase, type Tables } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type T = Pick<
  Tables<"tournaments">,
  "id" | "slug" | "name" | "starts_at" | "city" | "entry_fee_xof" | "status" | "is_demo"
>;

export default function Tournaments() {
  const [items, setItems] = useState<T[] | null>(null);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 18 * 3600_000).toISOString();
    const { data } = await supabase
      .from("tournaments")
      .select("id, slug, name, starts_at, city, entry_fee_xof, status, is_demo")
      .neq("status", "draft")
      .gte("starts_at", since)
      .order("starts_at")
      .limit(50);
    setItems(data ?? []);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen title="Tournois" onRefresh={load}>
      {items === null ? <Loading /> : null}
      {items?.length === 0 ? <Muted>Aucun tournoi annoncé pour l'instant.</Muted> : null}
      {items?.map((t) => (
        <Card key={t.id} label={t.name} onPress={() => router.push(`/tournoi/${t.slug}`)}>
          <Strong>{t.name}</Strong>
          <Muted>
            {formatDate(t.starts_at, "fr")}
            {t.city ? ` · ${t.city}` : ""}
          </Muted>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Text style={{ color: colors.ink }}>
              {t.entry_fee_xof === null
                ? "Tarif à confirmer"
                : t.entry_fee_xof === 0
                  ? "Gratuit"
                  : formatXof(t.entry_fee_xof, "fr")}
            </Text>
            {t.is_demo ? (
              <Text style={{ color: colors.stone, fontWeight: "700" }}>DÉMONSTRATION</Text>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
