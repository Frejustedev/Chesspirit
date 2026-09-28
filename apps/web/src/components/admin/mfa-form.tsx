"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui/form";

type State =
  | { step: "loading" }
  | { step: "enroll"; factorId: string; qr: string; secret: string }
  | { step: "verify"; factorId: string };

/** Double authentification TOTP (application d'authentification) via Supabase Auth. */
export function MfaForm({ next }: { next: string }) {
  const t = useTranslations("admin");
  const [state, setState] = useState<State>({ step: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === "verified");
      if (cancelled) return;
      if (verified) return setState({ step: "verify", factorId: verified.id });
      // Nettoie les facteurs non vérifiés d'une tentative précédente.
      for (const f of data?.all ?? [])
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Chesspirit ${Date.now()}`,
      });
      if (cancelled) return;
      if (error || !enrolled) return setError(t("mfaError"));
      setState({
        step: "enroll",
        factorId: enrolled.id,
        qr: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.step === "loading") return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: code.trim(),
    });
    if (error) {
      setBusy(false);
      return setError(t("mfaInvalid"));
    }
    window.location.assign(next);
  }

  if (state.step === "loading") return <p className="mt-6 text-stone">{error ?? t("loading")}</p>;
  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      {state.step === "enroll" ? (
        <div className="rounded-md border border-line p-4">
          <p className="text-sm">{t("mfaEnroll")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR SVG fourni par Supabase Auth */}
          <img src={state.qr} alt={t("mfaQrAlt")} className="mx-auto mt-3 size-48 bg-field p-2" />
          <p className="mt-2 break-all text-center font-mono text-sm" data-testid="totp-secret">
            {state.secret}
          </p>
        </div>
      ) : (
        <p>{t("mfaVerify")}</p>
      )}
      <Field id="totp" label={t("mfaCode")} error={error ?? undefined}>
        <Input
          id="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="tabular text-center text-2xl tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
        {t("mfaSubmit")}
      </Button>
    </form>
  );
}
