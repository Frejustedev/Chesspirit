"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Partage par lien : feuille de partage native du téléphone, sinon copie du lien. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline"
      aria-live="polite"
    >
      {copied ? t("linkCopied") : t("share")}
    </button>
  );
}
