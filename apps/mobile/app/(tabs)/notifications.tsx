import { useCallback, useState } from "react";
import { Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { formatDateTime } from "@chesspirit/shared";
import { Button, Card, Muted, Screen } from "@/components/ui";
import { registerPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type N = {
  id: string;
  created_at: string;
  payload: unknown;
  read_at: string | null;
  channel: string;
};

export default function NotificationsScreen() {
  const { profile } = useSession();
  const [items, setItems] = useState<N[]>([]);
  const [push, setPush] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, created_at, payload, read_at, channel")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data ?? []);
  }, [profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!profile)
    return (
      <Screen title="Notifications">
        <Muted>Connectez-vous pour voir vos notifications.</Muted>
        <Button label="Se connecter" onPress={() => router.push("/connexion")} />
      </Screen>
    );
  return (
    <Screen title="Notifications" onRefresh={load}>
      <Button
        label="Activer les notifications sur ce téléphone"
        variant="ghost"
        onPress={async () => {
          const r = await registerPush(profile.id);
          setPush(
            r === "granted"
              ? "Notifications activées."
              : r === "denied"
                ? "Autorisation refusée dans les réglages du téléphone."
                : "Disponible dans l'application installée.",
          );
        }}
      />
      {push ? <Muted>{push}</Muted> : null}
      {items.length === 0 ? <Muted>Aucune notification.</Muted> : null}
      {items.map((n) => {
        const p = n.payload as { subject?: string | null; text?: string };
        return (
          <Card
            key={n.id}
            label={p.subject ?? "Notification"}
            onPress={
              n.read_at
                ? undefined
                : async () => {
                    await supabase
                      .from("notifications")
                      .update({ read_at: new Date().toISOString() })
                      .eq("id", n.id);
                    void load();
                  }
            }
          >
            <Text style={{ fontWeight: n.read_at ? "400" : "700", color: colors.ink }}>
              {p.subject ?? p.text?.slice(0, 80)}
            </Text>
            {p.subject && p.text ? <Muted>{p.text}</Muted> : null}
            <Muted>{formatDateTime(n.created_at, "fr")}</Muted>
          </Card>
        );
      })}
    </Screen>
  );
}
