import { useCallback, useState } from "react";
import { Linking, Switch, Text, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { Button, Card, ErrorText, H2, Loading, Muted, Screen, Strong } from "@/components/ui";
import { registerError, registerForTournament } from "@/lib/api";
import { config, tr } from "@/lib/config";
import { useSession } from "@/lib/session";
import { supabase, type Tables } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type Player = { id: string; first_name: string; last_name: string };

export default function TournamentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session, profile } = useSession();
  const [t, setT] = useState<Tables<"tournaments"> | null | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [registered, setRegistered] = useState<Record<string, string>>({});
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [method, setMethod] = useState<"online" | "on_site">("on_site");
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("slug", slug ?? "")
      .neq("status", "draft")
      .maybeSingle();
    setT(data);
    if (!data || !profile) return;
    const { data: people } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .or(`id.eq.${profile.id},guardian_id.eq.${profile.id}`);
    setPlayers(people ?? []);
    setPlayerId((p) => p ?? profile.id);
    const { data: regs } = await supabase
      .from("registrations")
      .select("player_id, status, ticket_code")
      .eq("tournament_id", data.id)
      .not("status", "in", "(cancelled,refused)");
    setRegistered(Object.fromEntries((regs ?? []).map((r) => [r.player_id, r.ticket_code])));
  }, [slug, profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (t === undefined)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (t === null)
    return (
      <Screen title="Tournoi introuvable">
        <Muted>Ce tournoi n'existe pas ou n'est plus publié.</Muted>
      </Screen>
    );
  const free = t.entry_fee_xof === 0;
  const open = t.status === "registration_open";

  async function register() {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    const r = await registerForTournament({
      tournamentId: t!.id,
      playerId,
      paymentMethod: free ? "free" : method,
    });
    setBusy(false);
    if (!r.ok) return setError(registerError(r.error));
    if (r.paymentUrl) await WebBrowser.openBrowserAsync(r.paymentUrl);
    else if (r.ticketUrl) await WebBrowser.openBrowserAsync(r.ticketUrl);
    await load();
  }

  return (
    <Screen title={t.name}>
      <Stack.Screen options={{ title: t.name }} />
      {t.is_demo ? (
        <Text style={{ color: colors.stone, fontWeight: "700" }}>
          DÉMONSTRATION (données fictives)
        </Text>
      ) : null}
      <Muted>{formatDateTime(t.starts_at, "fr")}</Muted>
      <Muted>{[t.venue, t.city].filter(Boolean).join(", ") || "Lieu à confirmer"}</Muted>
      <Text style={{ marginTop: 8, color: colors.ink, fontSize: 16 }}>
        {t.entry_fee_xof === null
          ? "Frais d'inscription à confirmer"
          : free
            ? "Inscription gratuite"
            : `Inscription : ${formatXof(t.entry_fee_xof, "fr")}`}
      </Text>
      {tr(t.summary) ? (
        <Text style={{ marginTop: 12, color: colors.ink, fontSize: 16 }}>{tr(t.summary)}</Text>
      ) : null}

      <H2>Inscription</H2>
      {!open ? (
        <Muted>Les inscriptions ne sont pas ouvertes.</Muted>
      ) : !session ? (
        <Button label="Se connecter pour s'inscrire" onPress={() => router.push("/connexion")} />
      ) : !profile?.onboarded ? (
        <>
          <Muted>Complétez d'abord votre profil (identité et consentements) sur le site.</Muted>
          <Button
            label="Compléter mon profil"
            onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/compte/profil`)}
          />
        </>
      ) : t.entry_fee_xof === null ? (
        <Muted>Les frais d'inscription ne sont pas encore fixés.</Muted>
      ) : (
        <>
          {players.map((p) => (
            <Card
              key={p.id}
              label={`${p.first_name} ${p.last_name}`}
              onPress={registered[p.id] ? undefined : () => setPlayerId(p.id)}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Strong>
                  {p.first_name} {p.last_name}
                </Strong>
                <Text
                  style={{
                    color: registered[p.id]
                      ? colors.success
                      : playerId === p.id
                        ? colors.bordeaux
                        : colors.stone,
                    fontWeight: "700",
                  }}
                >
                  {registered[p.id] ? "Inscrit" : playerId === p.id ? "Choisi" : ""}
                </Text>
              </View>
              {registered[p.id] ? (
                <Text
                  accessibilityRole="link"
                  style={{ color: colors.bordeaux, marginTop: 4 }}
                  onPress={() => Linking.openURL(`${config.siteUrl}/billet/${registered[p.id]}`)}
                >
                  Voir le billet
                </Text>
              ) : null}
            </Card>
          ))}
          {!free ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Mobile Money"
                  variant={method === "online" ? "primary" : "ghost"}
                  onPress={() => setMethod("online")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Sur place"
                  variant={method === "on_site" ? "primary" : "ghost"}
                  onPress={() => setMethod("on_site")}
                />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
            <Switch
              value={rules}
              onValueChange={setRules}
              accessibilityLabel="J'accepte le règlement du tournoi"
              trackColor={{ true: colors.bordeaux }}
            />
            <Text style={{ flex: 1, color: colors.ink }}>
              J'accepte le{" "}
              <Text
                style={{ color: colors.bordeaux }}
                onPress={() => Linking.openURL(`${config.siteUrl}/legal/reglement-tournois`)}
              >
                règlement du tournoi
              </Text>
            </Text>
          </View>
          <Button
            label={free || method === "on_site" ? "Confirmer l'inscription" : "S'inscrire et payer"}
            onPress={register}
            disabled={busy || !rules || !playerId || !!registered[playerId]}
          />
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </Screen>
  );
}
