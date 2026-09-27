"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { CustomField } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { Checkbox, Field, Input, Select, Button } from "@/components/ui/form";
import { registerAction, resumePaymentAction } from "@/app/actions/registration";

type Player = {
  id: string;
  name: string;
  self: boolean;
  registration: { id: string; ticket_code: string; status: string; payment_status: string } | null;
};

export function RegistrationForm({
  tournamentId,
  players,
  fields,
  methods,
  feeKnown,
  locale,
}: {
  tournamentId: string;
  players: Player[];
  fields: CustomField[];
  methods: ("online" | "on_site" | "free")[];
  feeKnown: boolean;
  locale: string;
}) {
  const t = useTranslations("registration");
  const te = useTranslations("errors");
  const available = players.filter((p) => !p.registration);
  const [playerId, setPlayerId] = useState(available[0]?.id ?? "");
  const [method, setMethod] = useState(methods[0] ?? "on_site");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) return setError(t("acceptRequired"));
    start(async () => {
      const r = await registerAction({ tournamentId, playerId, paymentMethod: method, answers, acceptRules: true });
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("server"));
      window.location.assign(r.redirect.startsWith("http") ? r.redirect : `${locale === "fr" ? "" : `/${locale}`}${r.redirect}`);
    });
  }

  const registered = players.filter((p) => p.registration);

  return (
    <div className="space-y-8">
      {registered.length ? (
        <ul className="space-y-2">
          {registered.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-cream/50 p-3">
              <span>
                <strong>{p.name}</strong> — {t(`status.${p.registration!.status}`)}
              </span>
              {p.registration!.status === "pending_payment" ? (
                <Button
                  type="button"
                  className="min-h-11 px-4 text-sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await resumePaymentAction(p.registration!.id);
                      if (r.ok) window.location.assign(r.redirect);
                      else setError(te.has(r.error) ? te(r.error) : te("server"));
                    })
                  }
                >
                  {t("pay")}
                </Button>
              ) : (
                <Link href={`/billet/${p.registration!.ticket_code}`} className="font-semibold text-bordeaux hover:underline">
                  {t("ticket")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {available.length ? (
        <form onSubmit={submit} className="space-y-6" noValidate>
          <fieldset>
            <legend className="text-sm font-semibold">{t("who")}</legend>
            <div className="mt-2 space-y-2">
              {available.map((p) => (
                <label key={p.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 ${playerId === p.id ? "border-bordeaux bg-bordeaux-soft/40" : "border-line"}`}>
                  <input type="radio" name="player" value={p.id} checked={playerId === p.id} onChange={() => setPlayerId(p.id)} className="size-5 accent-[var(--color-bordeaux)]" />
                  <span className="font-medium">{p.name}</span>
                  {p.self ? <span className="text-sm text-stone">({t("me")})</span> : null}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm">
              <Link href="/compte/famille" className="font-semibold text-bordeaux hover:underline">
                {t("addChild")}
              </Link>
            </p>
          </fieldset>

          {fields.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map((f) => {
                const label = f.label[locale as "fr" | "en"] ?? f.label.fr;
                const id = `f-${f.key}`;
                if (f.type === "checkbox")
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <Checkbox id={id} label={label} checked={!!answers[f.key]} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.checked })} />
                    </div>
                  );
                return (
                  <Field key={f.key} id={id} label={label} optional={f.required ? undefined : t("optional")}>
                    {f.type === "select" ? (
                      <Select id={id} value={String(answers[f.key] ?? "")} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} required={f.required}>
                        <option value="">—</option>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input id={id} type={f.type === "number" ? "number" : "text"} value={String(answers[f.key] ?? "")} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} required={f.required} />
                    )}
                  </Field>
                );
              })}
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold">{t("payment")}</legend>
            <div className="mt-2 space-y-2">
              {methods.map((m) => (
                <label key={m} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3 ${method === m ? "border-bordeaux bg-bordeaux-soft/40" : "border-line"}`}>
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-0.5 size-5 accent-[var(--color-bordeaux)]" />
                  <span>
                    <span className="block font-medium">{t(`method.${m}`)}</span>
                    <span className="block text-sm text-stone">{t(`methodHelp.${m}`)}</span>
                  </span>
                </label>
              ))}
            </div>
            {!feeKnown ? <p className="mt-2 text-sm text-stone">{t("feeTbcHelp")}</p> : null}
          </fieldset>

          <Checkbox
            id="accept"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            label={t.rich("accept", {
              link: (c) => (
                <Link href="/legal/reglement-tournois" className="font-semibold text-bordeaux underline" target="_blank">
                  {c}
                </Link>
              ),
            })}
          />

          {error ? (
            <p role="alert" className="rounded bg-bordeaux-soft px-3 py-2 text-sm font-semibold text-bordeaux">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || !playerId} className="w-full sm:w-auto">
            {pending ? t("sending") : method === "online" ? t("submitPay") : t("submit")}
          </Button>
        </form>
      ) : (
        <p className="text-stone">{t("allRegistered")}</p>
      )}
    </div>
  );
}
