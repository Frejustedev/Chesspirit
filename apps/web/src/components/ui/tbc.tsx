import { useTranslations } from "next-intl";

/** Étiquette « À confirmer » pour les informations non arrêtées. */
export function Tbc() {
  const t = useTranslations("common");
  return <span className="tbc">{t("tbc")}</span>;
}
