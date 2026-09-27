"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { phoneSchema } from "@chesspirit/shared";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { IconPhone, IconMail, IconGlobe } from "@/components/icons";

type Mode = "phone" | "email";

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<Mode>("phone");
  const [identifier, setIdentifier] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const supabase = createClient();
    let value = identifier.trim();
    if (mode === "phone") {
      const parsed = phoneSchema.safeParse(value);
      if (!parsed.success) return setError(t("phoneInvalid"));
      value = parsed.data;
    } else if (!z.string().email().safeParse(value).success) {
      return setError(t("emailInvalid"));
    }
    setBusy(true);
    const { error } =
      mode === "phone"
        ? await supabase.auth.signInWithOtp({ phone: value })
        : await supabase.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(error.status === 429 ? t("tooMany") : t("sendError"));
    setSentTo(value);
    setCooldown(60);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      mode === "phone"
        ? await supabase.auth.verifyOtp({ phone: sentTo, token: code.trim(), type: "sms" })
        : await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      return setError(error.status === 429 ? t("tooMany") : t("codeInvalid"));
    }
    // Rechargement complet : les composants serveur relisent la session.
    window.location.assign(next);
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  const input =
    "mt-1 block min-h-12 w-full rounded-md border border-line bg-white px-3 text-[1.05rem] focus:border-bordeaux focus:outline-none";

  return (
    <div className="mt-6">
      {!sentTo ? (
        <>
          <div
            role="tablist"
            aria-label={t("method")}
            className="grid grid-cols-2 gap-1 rounded-full bg-cream p-1"
          >
            {(["phone", "email"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setIdentifier("");
                  setError(null);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold ${mode === m ? "bg-ink text-cream" : "text-ink/75"}`}
              >
                {m === "phone" ? <IconPhone className="size-4" /> : <IconMail className="size-4" />}
                {t(m)}
              </button>
            ))}
          </div>
          <form onSubmit={send} className="mt-5" noValidate>
            <label htmlFor="identifier" className="text-sm font-semibold">
              {mode === "phone" ? t("phoneLabel") : t("emailLabel")}
            </label>
            <input
              id="identifier"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type={mode === "phone" ? "tel" : "email"}
              inputMode={mode === "phone" ? "tel" : "email"}
              autoComplete={mode === "phone" ? "tel" : "email"}
              placeholder={mode === "phone" ? "+229 01 97 00 00 00" : "vous@exemple.com"}
              className={input}
              aria-invalid={!!error}
              aria-describedby="login-help"
              required
            />
            <p id="login-help" className="mt-1.5 text-sm text-stone">
              {mode === "phone" ? t("phoneHelp") : t("emailHelp")}
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 min-h-12 w-full rounded-full bg-bordeaux font-semibold text-cream hover:bg-ink disabled:opacity-60"
            >
              {busy ? t("sending") : t("sendCode")}
            </button>
          </form>
          {googleEnabled ? (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-stone">
                <span className="h-px flex-1 bg-line" /> {t("or")}{" "}
                <span className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                onClick={google}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/25 font-semibold hover:bg-cream"
              >
                <IconGlobe className="size-5" /> {t("google")}
              </button>
            </>
          ) : null}
          <p className="mt-6 text-xs text-stone">{t("newAccount")}</p>
        </>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="text-[1.02rem]">{t("codeSent", { to: sentTo })}</p>
          <label htmlFor="code" className="mt-4 block text-sm font-semibold">
            {t("codeLabel")}
          </label>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            className={`${input} tabular text-center text-2xl tracking-[0.5em]`}
            autoFocus
            required
          />
          {error ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="mt-5 min-h-12 w-full rounded-full bg-bordeaux font-semibold text-cream hover:bg-ink disabled:opacity-60"
          >
            {busy ? t("verifying") : t("verify")}
          </button>
          <div className="mt-4 flex justify-between text-sm">
            <button
              type="button"
              className="min-h-11 font-semibold text-bordeaux"
              onClick={() => {
                setSentTo(null);
                setCode("");
              }}
            >
              {t("change")}
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={() => send()}
              className="min-h-11 font-semibold text-bordeaux disabled:text-stone"
            >
              {cooldown > 0 ? t("resendIn", { s: cooldown }) : t("resend")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
