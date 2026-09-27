"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { countdownParts } from "@chesspirit/shared";

/** Compte à rebours présenté comme une pendule d'échecs (effet signature de l'accueil). */
export function ChessClock({ target, compact = false }: { target: string; compact?: boolean }) {
  const t = useTranslations("countdown");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const c = countdownParts(new Date(target), now ?? new Date(0));
  const ready = now !== null;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (ready && c.done) {
    return <p className="font-display text-3xl text-gold">{t("started")}</p>;
  }

  return (
    <div className={`relative inline-block ${compact ? "origin-top scale-[0.86]" : ""}`} role="timer" aria-label={ready ? t("aria", { days: c.days, hours: c.hours, minutes: c.minutes }) : t("loading")}>
      {/* Poussoirs de la pendule */}
      <div className="absolute -top-3 left-0 flex w-full justify-between px-[18%]" aria-hidden>
        <span className="h-3 w-10 rounded-t-md bg-cream/25" />
        <span className={`h-3 w-10 rounded-t-md transition-transform duration-300 ${c.seconds % 2 ? "bg-gold translate-y-0.5" : "bg-gold/80"}`} />
      </div>
      <div className="flex items-stretch gap-2 rounded-lg border border-cream/15 bg-ink-soft p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_18px_40px_-20px_rgb(0_0_0/0.9)] sm:gap-3 sm:p-3">
        <Face big={ready ? pad(c.days) : "––"} label={t("days")} />
        <div className="flex items-center gap-1 rounded-md bg-cream px-3 py-2 text-ink sm:px-4" aria-hidden>
          <Face light big={ready ? pad(c.hours) : "––"} label={t("hours")} />
          <span className="pb-5 font-display text-3xl text-ink/40 sm:text-4xl">:</span>
          <Face light big={ready ? pad(c.minutes) : "––"} label={t("minutes")} />
          <span className="pb-5 font-display text-3xl text-ink/40 sm:text-4xl">:</span>
          <Face light big={ready ? pad(c.seconds) : "––"} label={t("seconds")} tick />
        </div>
      </div>
    </div>
  );
}

function Face({ big, label, light = false, tick = false }: { big: string; label: string; light?: boolean; tick?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${light ? "" : "rounded-md bg-ink px-3 py-2 text-cream sm:px-4"}`}>
      <span
        suppressHydrationWarning
        key={tick ? big : undefined}
        className={`tabular font-display text-[2.1rem] font-semibold leading-none sm:text-5xl ${tick ? "animate-[tick_400ms_var(--ease-out-soft)]" : ""}`}
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {big}
      </span>
      <span className={`mt-1 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${light ? "text-ink/60" : "text-cream/60"}`}>
        {label}
      </span>
    </div>
  );
}
