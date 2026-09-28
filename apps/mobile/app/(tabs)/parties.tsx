import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { formatDate } from "@chesspirit/shared";
import { Button, Card, Muted, Screen, Strong } from "@/components/ui";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type G = {
  id: string;
  white_name: string;
  black_name: string;
  result: string;
  played_on: string | null;
  white_id: string | null;
  tournaments: { name: string } | null;
};

export default function Games() {
  const { profile } = useSession();
  const [games, setGames] = useState<G[]>([]);
  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("games")
      .select("id, white_name, black_name, result, played_on, white_id, tournaments(name)")
      .or(`white_id.eq.${profile.id},black_id.eq.${profile.id}`)
      .order("played_on", { ascending: false, nullsFirst: false })
      .limit(100);
    setGames((data ?? []) as G[]);
  }, [profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!profile)
    return (
      <Screen title="Mes parties">
        <Muted>Connectez-vous pour retrouver vos parties.</Muted>
        <Button label="Se connecter" onPress={() => router.push("/connexion")} />
      </Screen>
    );
  const score = (g: G) => {
    if (g.result === "1/2-1/2") return "½";
    const won = (g.result === "1-0") === (g.white_id === profile.id);
    return won ? "Gain" : "Perte";
  };
  return (
    <Screen title="Mes parties" onRefresh={load}>
      {games.length === 0 ? <Muted>Aucune partie enregistrée pour l'instant.</Muted> : null}
      {games.map((g) => (
        <Card
          key={g.id}
          label={`${g.white_name} contre ${g.black_name}`}
          onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/parties/${g.id}`)}
        >
          <Strong>
            {g.white_name} – {g.black_name}
          </Strong>
          <Muted>
            {g.result === "1/2-1/2" ? "½-½" : g.result} · {score(g)}
            {g.tournaments ? ` · ${g.tournaments.name}` : ""}
            {g.played_on ? ` · ${formatDate(g.played_on, "fr")}` : ""}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
