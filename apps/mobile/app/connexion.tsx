import { useState } from "react";
import { router } from "expo-router";
import { Button, ErrorText, Field, Muted, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/** Connexion sans mot de passe : code à usage unique par SMS ou e-mail (comme sur le site). */
export default function Login() {
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEmail = id.includes("@");
  const normalized = isEmail ? id.trim().toLowerCase() : id.replace(/[\s.-]/g, "");

  async function send() {
    setError(null);
    if (!isEmail && !/^\+[1-9]\d{7,14}$/.test(normalized))
      return setError("Numéro au format international, par exemple +229 01 90 00 00 00.");
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithOtp(
      isEmail ? { email: normalized } : { phone: normalized },
    );
    setBusy(false);
    if (e) return setError("Envoi impossible pour le moment. Réessayez dans quelques instants.");
    setSent(true);
  }

  async function verify() {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp(
      isEmail
        ? { email: normalized, token: code.trim(), type: "email" }
        : { phone: normalized, token: code.trim(), type: "sms" },
    );
    setBusy(false);
    if (e) return setError("Code incorrect ou expiré.");
    router.back();
  }

  return (
    <Screen title="Connexion">
      {!sent ? (
        <>
          <Field
            label="Téléphone ou e-mail"
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
            autoComplete="tel"
            keyboardType={isEmail ? "email-address" : "phone-pad"}
            placeholder="+229 01 90 00 00 00"
          />
          <Button label="Recevoir un code" onPress={send} disabled={busy || id.trim().length < 5} />
        </>
      ) : (
        <>
          <Muted>Un code a été envoyé à {normalized}.</Muted>
          <Field
            label="Code reçu"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <Button label="Se connecter" onPress={verify} disabled={busy || code.trim().length < 6} />
          <Button label="Changer de numéro" variant="ghost" onPress={() => setSent(false)} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
