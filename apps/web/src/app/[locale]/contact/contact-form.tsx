"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { sendContact } from "@/app/actions/contact";

export function ContactForm() {
  const t = useTranslations("contact");
  const [state, action, pending] = useActionState(sendContact, null);
  if (state?.ok)
    return (
      <p role="status" className="self-start rounded-lg bg-gold-soft/60 p-6 font-serif text-xl">
        {t("thanks")}
      </p>
    );
  return (
    <form action={action} className="space-y-5 rounded-lg border border-line p-5 sm:p-6">
      <Field id="name" label={t("name")}>
        <Input id="name" name="name" required maxLength={120} autoComplete="name" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="email" label={t("email")} optional={t("optional")}>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </Field>
        <Field id="phone" label={t("phone")} optional={t("optional")}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>
      <Field id="topic" label={t("topic")}>
        <Select id="topic" name="topic" defaultValue="general">
          {(
            [
              "general",
              "tournament",
              "organizer",
              "coaching",
              "shop",
              "partnership",
              "data",
            ] as const
          ).map((k) => (
            <option key={k} value={k}>
              {t(`topics.${k}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="message" label={t("message")}>
        <textarea
          id="message"
          name="message"
          required
          maxLength={5000}
          rows={6}
          className="mt-1 w-full rounded-md border border-line bg-white p-3 focus:border-bordeaux focus:outline-none"
        />
      </Field>
      {/* Champ piège anti-robots, invisible pour les humains */}
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
          {t("error")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}
