"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { countdownParts } from "@chesspirit/shared";

/**
 * Compte à rebours présenté comme une pendule d'échecs (effet signature de l'accueil).
 * `dateOnly` : horaire non confirmé, on ne compte que les jours (aucune heure inventée).
 */
export function ChessClock({
  target,
  compact = false,
  dateOnly = false,
}: {
  target: string;
  compact?: boolean;
  dateOnly?: boolean;
}) {
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
  // Jours calendaires restants (la date seule est connue).
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(target).getTime() - (now ?? new Date(0)).getTime()) / 86_400_000),
  );

  if (ready && dateOnly && daysLeft === 0) {
    return <p className="font-display text-3xl text-gold">{t("today")}</p>;
  }
  if (ready && !dateOnly && c.done) {
    return <p className="font-display text-3xl text-gold">{t("started")}</p>;
  }

  return (
    <div
      className={`relative inline-block ${compact ? "origin-top scale-[0.86]" : ""}`}
      role="timer"
      aria-label={
        !ready
          ? t("loading")
          : dateOnly
            ? t("ariaDays", { days: daysLeft })
            : t("aria", { days: c.days, hours: c.hours, minutes: c.minutes })
      }
    >
      {/* Poussoirs de la pendule */}
      <div className="absolute -top-3 left-0 flex w-full justify-between px-[18%]" aria-hidden>
        <span className="h-3 w-10 rounded-t-md bg-surface/25" />
        <span
          className={`h-3 w-10 rounded-t-md transition-transform duration-300 ${c.seconds % 2 ? "bg-gold translate-y-0.5" : "bg-gold/80"}`}
        />
      </div>
      <div className="flex items-stretch gap-2 rounded-lg border border-cream/15 bg-ink-soft p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_18px_40px_-20px_rgb(0_0_0/0.9)] sm:gap-3 sm:p-3">
        <Face big={ready ? pad(dateOnly ? daysLeft : c.days) : "––"} label={t("days")} />
        {dateOnly ? (
          <div
            className="flex max-w-40 items-center rounded-md bg-surface px-3 py-2 font-sans text-sm font-semibold leading-snug text-fg sm:px-4"
            aria-hidden
          >
            {t("timeTbc")}
          </div>
        ) : (
          <div
            className="flex items-center gap-1 rounded-md bg-surface px-3 py-2 text-fg sm:px-4"
            aria-hidden
          >
            <Face light big={ready ? pad(c.hours) : "––"} label={t("hours")} />
            <span className="pb-5 font-display text-3xl text-fg/40 sm:text-4xl">:</span>
            <Face light big={ready ? pad(c.minutes) : "––"} label={t("minutes")} />
            <span className="pb-5 font-display text-3xl text-fg/40 sm:text-4xl">:</span>
            <Face light big={ready ? pad(c.seconds) : "––"} label={t("seconds")} tick />
          </div>
        )}
      </div>
    </div>
  );
}

function Face({
  big,
  label,
  light = false,
  tick = false,
}: {
  big: string;
  label: string;
  light?: boolean;
  tick?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center ${light ? "" : "rounded-md bg-ink px-3 py-2 text-cream sm:px-4"}`}
    >
      <span
        suppressHydrationWarning
        key={tick ? big : undefined}
        className={`tabular font-display text-[2.1rem] font-semibold leading-none sm:text-5xl ${tick ? "animate-[tick_400ms_var(--ease-out-soft)]" : ""}`}
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {big}
      </span>
      <span
        className={`mt-1 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${light ? "text-fg/60" : "text-cream/60"}`}
      >
        {label}
      </span>
    </div>
  );
}
