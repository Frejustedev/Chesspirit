"use client";

import { useTranslations } from "next-intl";
import { IconPrint } from "@/components/icons";

export function PrintButton() {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-bordeaux px-5 font-semibold text-cream hover:bg-ink"
    >
      <IconPrint className="size-5" /> {t("print")}
    </button>
  );
}
