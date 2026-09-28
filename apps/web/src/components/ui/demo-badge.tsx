import { useTranslations } from "next-intl";

/** Signale une donnée de démonstration (fictive). */
export function DemoBadge({ dark = false }: { dark?: boolean }) {
  const t = useTranslations("common");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 align-middle font-sans text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${
        dark ? "border-cream/30 text-cream/70" : "border-stone/40 text-stone"
      }`}
      title={t("demoTitle")}
    >
      {t("demo")}
    </span>
  );
}
