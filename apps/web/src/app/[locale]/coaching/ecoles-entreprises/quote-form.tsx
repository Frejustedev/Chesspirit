"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { quoteAction } from "@/app/actions/coaching";

export function QuoteForm({ defaultKind = "school" }: { defaultKind?: string }) {
  const t = useTranslations("quote");
  const [state, action, pending] = useActionState(quoteAction, null);
  if (state?.ok)
    return (
      <p role="status" className="self-start rounded-lg bg-gold-soft/60 p-6 font-serif text-xl">
        {t("thanks")}
      </p>
    );
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line p-5 sm:p-6">
      <Field id="kind" label={t("kind")}>
        <Select id="kind" name="kind" defaultValue={defaultKind}>
          {(["school", "company", "club", "event", "group_order", "rental"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="organization" label={t("organization")}>
        <Input id="organization" name="organization" required />
      </Field>
      <Field id="contact_name" label={t("contact")}>
        <Input id="contact_name" name="contact_name" required autoComplete="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="phone" label={t("phone")}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field id="email" label={t("email")}>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </Field>
        <Field id="city" label={t("city")}>
          <Input id="city" name="city" />
        </Field>
        <Field id="participants" label={t("participants")}>
          <Input id="participants" name="participants" type="number" min={1} />
        </Field>
      </div>
      <Field id="message" label={t("message")}>
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </Field>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      {state && !state.ok ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error === "contact_required" ? t("contactRequired") : t("error")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}
