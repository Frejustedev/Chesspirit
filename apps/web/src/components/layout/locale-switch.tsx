"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, start] = useTransition();
  return (
    <div
      className="flex items-center rounded-full border border-line p-0.5 text-sm font-semibold"
      aria-busy={pending}
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          onClick={() =>
            start(() =>
              // @ts-expect-error -- les paramètres dynamiques de la route courante sont conservés
              router.replace({ pathname, params }, { locale: l }),
            )
          }
          className={`min-h-9 min-w-10 rounded-full px-2.5 uppercase transition-colors ${
            locale === l ? "bg-gold text-onaccent" : "text-fg/70 hover:text-accent"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
