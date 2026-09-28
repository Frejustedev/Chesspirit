"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter } from "@/app/actions/newsletter";

export function NewsletterForm() {
  const t = useTranslations("footer");
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok)
    return (
      <p className="mt-3 text-sm text-gold" role="status">
        {t("newsletterThanks")}
      </p>
    );
  return (
    <form action={action} className="mt-3 flex gap-2">
      <label htmlFor="nl-email" className="sr-only">
        {t("email")}
      </label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-cream/25 bg-transparent px-4 text-cream placeholder:text-cream/45 focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full bg-gold px-4 font-semibold text-ink hover:bg-cream disabled:opacity-60"
      >
        {t("subscribe")}
      </button>
      {state?.error ? (
        <p className="sr-only" role="alert">
          {t("newsletterError")}
        </p>
      ) : null}
    </form>
  );
}
