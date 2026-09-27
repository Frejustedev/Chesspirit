"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  BENIN_DEPARTMENTS,
  profileSchema,
  childSchema,
  type ProfileInput,
} from "@chesspirit/shared";
import type { z } from "zod";
import { Field, Input, Select, Checkbox, Button } from "@/components/ui/form";
import { saveProfile, addChild, type ActionResult } from "@/app/actions/profile";

type Mode = "onboarding" | "edit" | "child";

export function ProfileForm({
  mode,
  defaults,
  next,
}: {
  mode: Mode;
  defaults?: Partial<ProfileInput>;
  next?: string;
}) {
  const t = useTranslations("profile");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [consents, setConsents] = useState({
    terms: false,
    newsletter: false,
    public_profile: false,
    image_rights: false,
  });
  const schema = mode === "child" ? childSchema : profileSchema;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(schema),
    defaultValues: { country: "BJ", ...defaults },
  });

  const msg = (m?: string) => (m ? (te.has(m) ? te(m) : te("invalid")) : undefined);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    if (mode === "onboarding" && !consents.terms) {
      setServerError(te("terms_required"));
      return;
    }
    start(async () => {
      let res: ActionResult;
      if (mode === "child") res = await addChild(values, consents.image_rights);
      else res = await saveProfile(values, consents);
      if (!res.ok) {
        if (res.fields)
          for (const [k, v] of Object.entries(res.fields))
            setError(k as keyof ProfileInput, { message: v });
        setServerError(te.has(res.error) ? te(res.error) : te("server"));
        return;
      }
      if (mode === "onboarding" && next) window.location.assign(next);
      else if (mode === "child") {
        reset({ country: "BJ" });
        setDone(true);
      } else setDone(true);
    });
  });

  const aria = (k: keyof ProfileInput) => ({
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });
  const personal = mode === "child" ? "off" : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="first_name" label={t("firstName")} error={msg(errors.first_name?.message)}>
          <Input
            id="first_name"
            autoComplete={personal ?? "given-name"}
            {...register("first_name")}
            {...aria("first_name")}
          />
        </Field>
        <Field id="last_name" label={t("lastName")} error={msg(errors.last_name?.message)}>
          <Input
            id="last_name"
            autoComplete={personal ?? "family-name"}
            {...register("last_name")}
            {...aria("last_name")}
          />
        </Field>
        <Field id="birth_date" label={t("birthDate")} error={msg(errors.birth_date?.message)}>
          <Input
            id="birth_date"
            type="date"
            autoComplete={personal ?? "bday"}
            {...register("birth_date")}
            {...aria("birth_date")}
          />
        </Field>
        <Field id="sex" label={t("sex")} error={msg(errors.sex?.message)}>
          <Select id="sex" {...register("sex")} {...aria("sex")} defaultValue={defaults?.sex ?? ""}>
            <option value="" disabled>
              {t("choose")}
            </option>
            <option value="F">{t("female")}</option>
            <option value="M">{t("male")}</option>
          </Select>
        </Field>
        <Field id="city" label={t("city")} error={msg(errors.city?.message)}>
          <Input id="city" autoComplete="address-level2" {...register("city")} {...aria("city")} />
        </Field>
        <Field id="department" label={t("department")} error={msg(errors.department?.message)}>
          <Select
            id="department"
            {...register("department")}
            {...aria("department")}
            defaultValue={defaults?.department ?? ""}
          >
            <option value="" disabled>
              {t("choose")}
            </option>
            {BENIN_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="club_name"
          label={t("club")}
          optional={t("optional")}
          error={msg(errors.club_name?.message)}
        >
          <Input id="club_name" {...register("club_name")} />
        </Field>
        <Field
          id="fide_id"
          label={t("fideId")}
          optional={t("optional")}
          hint={t("fideHint")}
          error={msg(errors.fide_id?.message)}
        >
          <Input id="fide_id" inputMode="numeric" {...register("fide_id")} {...aria("fide_id")} />
        </Field>
      </div>

      {mode === "onboarding" ? (
        <fieldset className="rounded-md border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{t("consents")}</legend>
          <Checkbox
            id="c-terms"
            checked={consents.terms}
            onChange={(e) => setConsents({ ...consents, terms: e.target.checked })}
            label={t("consentTerms")}
            required
          />
          <Checkbox
            id="c-public"
            checked={consents.public_profile}
            onChange={(e) => setConsents({ ...consents, public_profile: e.target.checked })}
            label={t("consentPublic")}
          />
          <Checkbox
            id="c-image"
            checked={consents.image_rights}
            onChange={(e) => setConsents({ ...consents, image_rights: e.target.checked })}
            label={t("consentImage")}
          />
          <Checkbox
            id="c-news"
            checked={consents.newsletter}
            onChange={(e) => setConsents({ ...consents, newsletter: e.target.checked })}
            label={t("consentNewsletter")}
          />
        </fieldset>
      ) : null}
      {mode === "child" ? (
        <fieldset className="rounded-md border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{t("parentalConsent")}</legend>
          <p className="text-sm text-stone">{t("parentalText")}</p>
          <Checkbox
            id="c-image-child"
            checked={consents.image_rights}
            onChange={(e) => setConsents({ ...consents, image_rights: e.target.checked })}
            label={t("consentImageChild")}
          />
        </fieldset>
      ) : null}

      {serverError ? (
        <p
          role="alert"
          className="rounded bg-bordeaux-soft px-3 py-2 text-sm font-semibold text-bordeaux"
        >
          {serverError}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="rounded bg-gold-soft/60 px-3 py-2 text-sm font-semibold">
          {mode === "child" ? t("childAdded") : t("saved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending
          ? t("saving")
          : mode === "onboarding"
            ? t("create")
            : mode === "child"
              ? t("addChild")
              : t("save")}
      </Button>
    </form>
  );
}
