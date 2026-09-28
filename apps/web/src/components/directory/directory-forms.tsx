"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui/form";
import {
  claimOrganizationAction,
  postJobAction,
  proposeOrganizationAction,
  saveArbiterProfileAction,
} from "@/app/actions/directory";
import { ORG_TYPES } from "@/lib/orgs";

function Status({ state }: { state: { ok: boolean; error?: string } | null }) {
  const t = useTranslations("directory");
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded px-3 py-2 text-sm font-semibold ${state.ok ? "bg-gold-soft/60" : "bg-bordeaux-soft text-rose"}`}
    >
      {state.ok
        ? t("sent")
        : t.has(`errors.${state.error}`)
          ? t(`errors.${state.error}`)
          : t("errors.generic")}
    </p>
  );
}

export function ClaimForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations("directory");
  const [state, action, pending] = useActionState(claimOrganizationAction, null);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field id="claim-role" label={t("claimRole")}>
        <Input id="claim-role" name="role" required minLength={2} maxLength={80} />
      </Field>
      <div>
        <label htmlFor="claim-msg" className="block text-sm font-semibold">
          {t("claimMessage")}
        </label>
        <textarea
          id="claim-msg"
          name="message"
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {t("claimButton")}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ProposeForm() {
  const t = useTranslations("directory");
  const [state, action, pending] = useActionState(proposeOrganizationAction, null);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field id="o-type" label={t("type")}>
        <Select id="o-type" name="type" defaultValue="club">
          {ORG_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`orgType.${x}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="o-name" label={t("name")}>
        <Input id="o-name" name="name" required maxLength={120} />
      </Field>
      <Field id="o-dep" label={t("department")}>
        <Select id="o-dep" name="department" defaultValue="">
          <option value="">—</option>
          {BENIN_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="o-city" label={t("city")}>
        <Input id="o-city" name="city" maxLength={80} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="o-address" label={t("address")}>
          <Input id="o-address" name="address" maxLength={200} />
        </Field>
      </div>
      <Field id="o-phone" label={t("phone")}>
        <Input id="o-phone" name="phone" type="tel" />
      </Field>
      <Field id="o-email" label={t("email")}>
        <Input id="o-email" name="email" type="email" />
      </Field>
      <Field id="o-web" label={t("website")}>
        <Input id="o-web" name="website" type="url" placeholder="https://" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field id="o-lat" label={t("lat")}>
          <Input id="o-lat" name="lat" inputMode="decimal" placeholder="6.3654" />
        </Field>
        <Field id="o-lng" label={t("lng")}>
          <Input id="o-lng" name="lng" inputMode="decimal" placeholder="2.4183" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="o-desc" className="block text-sm font-semibold">
          {t("description")}
        </label>
        <textarea
          id="o-desc"
          name="description"
          rows={4}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </div>
      <input
        type="text"
        name="website_hp"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("proposeButton")}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Status state={state} />
      </div>
    </form>
  );
}

export function JobForm() {
  const t = useTranslations("directory");
  const [state, action, pending] = useActionState(postJobAction, null);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field id="j-kind" label={t("jobKind")}>
        <Select id="j-kind" name="kind" defaultValue="coach">
          {(["coach", "arbiter", "organizer", "other"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`jobKinds.${k}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="j-contract" label={t("contract")}>
        <Select id="j-contract" name="contract" defaultValue="">
          <option value="">—</option>
          {(["volunteer", "freelance", "part_time", "full_time", "mission"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`contracts.${k}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="j-title" label={t("jobTitle")}>
          <Input id="j-title" name="title" required minLength={5} maxLength={120} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="j-desc" className="block text-sm font-semibold">
          {t("description")}
        </label>
        <textarea
          id="j-desc"
          name="description"
          required
          minLength={20}
          rows={5}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </div>
      <Field id="j-city" label={t("city")}>
        <Input id="j-city" name="city" maxLength={80} />
      </Field>
      <Field id="j-pay" label={t("pay")}>
        <Input id="j-pay" name="pay_note" maxLength={200} />
      </Field>
      <Field id="j-contact" label={t("contact")}>
        <Input id="j-contact" name="contact" required minLength={5} maxLength={200} />
      </Field>
      <Field id="j-exp" label={t("expires")}>
        <Input id="j-exp" name="expires_on" type="date" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("postJob")}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Status state={state} />
      </div>
    </form>
  );
}

export function ArbiterForm({
  initial,
}: {
  initial: {
    title: string;
    zone: string;
    availability: string;
    languages: string[];
    is_public: boolean;
  } | null;
}) {
  const t = useTranslations("directory");
  const [v, setV] = useState(
    initial ?? { title: "", zone: "", availability: "", languages: ["fr"], is_public: true },
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggleLang = (l: string) =>
    setV({
      ...v,
      languages: v.languages.includes(l) ? v.languages.filter((x) => x !== l) : [...v.languages, l],
    });
  return (
    <section id="arbitre" className="rounded-lg border border-line p-5">
      <h2 className="font-display text-2xl font-semibold">{t("arbiterCard")}</h2>
      <p className="mt-1 text-sm text-stone">{t("arbiterCardHelp")}</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveArbiterProfileAction(v);
            setMsg(
              r.ok
                ? t("saved")
                : t.has(`errors.${r.error}`)
                  ? t(`errors.${r.error}`)
                  : t("errors.generic"),
            );
          });
        }}
      >
        <Field id="a-title" label={t("arbiterTitleLabel")}>
          <Select
            id="a-title"
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
          >
            <option value="">—</option>
            {(["IA", "FA", "NA", "regional", "club", "trainee"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`arbiterTitle.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="a-zone" label={t("zone")}>
          <Input
            id="a-zone"
            value={v.zone}
            maxLength={120}
            onChange={(e) => setV({ ...v, zone: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="a-av" label={t("availability")}>
            <Input
              id="a-av"
              value={v.availability}
              maxLength={500}
              onChange={(e) => setV({ ...v, availability: e.target.value })}
            />
          </Field>
        </div>
        <fieldset className="flex flex-wrap gap-4 sm:col-span-2">
          <legend className="mb-1 text-sm font-semibold">{t("language")}</legend>
          {(["fr", "en", "fon"] as const).map((l) => (
            <Checkbox
              key={l}
              id={`a-l-${l}`}
              checked={v.languages.includes(l)}
              onChange={() => toggleLang(l)}
              label={l.toUpperCase()}
            />
          ))}
        </fieldset>
        <div className="sm:col-span-2">
          <Checkbox
            id="a-public"
            checked={v.is_public}
            onChange={(e) => setV({ ...v, is_public: e.target.checked })}
            label={t("arbiterPublic")}
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending || !v.languages.length}>
            {t("save")}
          </Button>
          {msg ? (
            <span role="status" className="text-sm font-semibold">
              {msg}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
