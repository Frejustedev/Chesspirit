import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Button, ErrorText, Field, H2, Muted, Screen, Strong } from "@/components/ui";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { session, profile, reload } = useSession();
  const [city, setCity] = useState("");
  const [club, setClub] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCity(profile?.city ?? "");
    setClub(profile?.club_name ?? "");
  }, [profile]);

  if (!session)
    return (
      <Screen title="Profil">
        <Muted>Connectez-vous pour gérer votre profil, vos inscriptions et vos parties.</Muted>
        <Button label="Se connecter" onPress={() => router.push("/connexion")} />
      </Screen>
    );
  const web = (path: string) => WebBrowser.openBrowserAsync(`${config.siteUrl}${path}`);
  return (
    <Screen title="Profil">
      {profile ? (
        <>
          <Strong>
            {profile.first_name} {profile.last_name}
          </Strong>
          <Muted>{[profile.phone, profile.email].filter(Boolean).join(" · ")}</Muted>
          {profile.fide_id ? <Muted>FIDE {profile.fide_id}</Muted> : null}
          {profile.onboarded ? (
            <>
              <H2>Mes informations</H2>
              <Field label="Ville" value={city} onChangeText={setCity} maxLength={80} />
              <Field label="Club" value={club} onChangeText={setClub} maxLength={120} />
              <Button
                label="Enregistrer"
                onPress={async () => {
                  setMsg(null);
                  setError(null);
                  const { error: e } = await supabase
                    .from("profiles")
                    .update({ city: city.trim() || null, club_name: club.trim() || null })
                    .eq("id", profile.id);
                  if (e) return setError("Enregistrement impossible.");
                  setMsg("Profil enregistré.");
                  await reload();
                }}
              />
              {msg ? <Muted>{msg}</Muted> : null}
              <ErrorText>{error}</ErrorText>
            </>
          ) : (
            <>
              <Muted>Votre profil n'est pas encore complété.</Muted>
              <Button
                label="Compléter mon profil sur le site"
                onPress={() => web("/compte/profil")}
              />
            </>
          )}
        </>
      ) : (
        <Muted>Profil introuvable.</Muted>
      )}
      <H2>Mon compte</H2>
      <Button
        label="Carte de membre et badges"
        variant="ghost"
        onPress={() => web("/communaute/adhesion")}
      />
      <Button label="Famille (enfants)" variant="ghost" onPress={() => web("/compte/famille")} />
      <Button
        label="Mes données et suppression du compte"
        variant="ghost"
        onPress={() => web("/compte/donnees")}
      />
      <Button
        label="Se déconnecter"
        onPress={async () => {
          await supabase.auth.signOut();
        }}
      />
    </Screen>
  );
}
