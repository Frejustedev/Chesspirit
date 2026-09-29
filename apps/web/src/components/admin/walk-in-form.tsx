"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { walkInAction } from "@/app/actions/admin";

/** Ajout d'un joueur présent le jour même, sans inscription préalable. */
export function WalkInForm({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("walkIn");
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const field =
    "min-h-11 w-full rounded-md border border-line bg-field px-3 text-[1rem] focus:border-accent";
  return (
    <details className="mt-6 rounded-lg border border-gold/40 bg-gold-soft/30 p-4" open>
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        {t("title")}
      </summary>
      <p className="mt-1 text-sm text-stone">{t("help")}</p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const row = Object.fromEntries(
            ["first_name", "last_name", "sex", "birth_date", "phone", "club"].map((k) => [
              k,
              String(f.get(k) ?? "").trim(),
            ]),
          );
          start(async () => {
            const r = await walkInAction(tournamentId, row, f.get("check_in") === "on");
            if (r.ok) {
              setMsg({
                ok: true,
                text: t(r.data!.already ? "doneAlready" : "done", { name: r.data!.name }),
              });
              form.reset();
              (form.elements.namedItem("first_name") as HTMLInputElement | null)?.focus();
              router.refresh();
            } else {
              setMsg({
                ok: false,
                text: t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.invalid"),
              });
            }
          });
        }}
      >
        <label className="block text-sm font-semibold">
          {t("firstName")}
          <input
            name="first_name"
            required
            maxLength={80}
            autoComplete="off"
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t("lastName")}
          <input
            name="last_name"
            required
            maxLength={80}
            autoComplete="off"
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t("sex")}
          <select name="sex" defaultValue="" className={`mt-1 ${field}`}>
            <option value="">—</option>
            <option value="M">{t("male")}</option>
            <option value="F">{t("female")}</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t("birthDate")} <span className="font-normal text-stone">({t("optional")})</span>
          <input name="birth_date" type="date" className={`mt-1 ${field}`} />
        </label>
        <label className="block text-sm font-semibold">
          {t("phone")} <span className="font-normal text-stone">({t("optional")})</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+229…"
            maxLength={20}
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t("club")} <span className="font-normal text-stone">({t("optional")})</span>
          <input name="club" maxLength={120} className={`mt-1 ${field}`} />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="check_in"
              defaultChecked
              className="size-5 accent-[var(--color-gold)]"
            />
            {t("checkInNow")}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 font-semibold text-onaccent hover:bg-gold-deep disabled:opacity-60"
          >
            {busy ? t("adding") : t("add")}
          </button>
          {msg ? (
            <p role="status" className={msg.ok ? "text-success" : "text-danger"}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
