"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Checkbox, Button } from "@/components/ui/form";
import { requestDeletion, setConsent } from "@/app/actions/profile";

export function ConsentToggles({
  initial,
  minor,
}: {
  initial: Record<string, boolean>;
  minor: boolean;
}) {
  const t = useTranslations("profile");
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const toggle = (type: "newsletter" | "public_profile" | "image_rights", v: boolean) => {
    setState({ ...state, [type]: v });
    start(async () => {
      await setConsent(type, v);
    });
  };
  return (
    <div className="mt-3 max-w-2xl" aria-busy={pending}>
      <Checkbox
        id="t-public"
        disabled={minor}
        checked={!!state.public_profile}
        onChange={(e) => toggle("public_profile", e.target.checked)}
        label={t("consentPublic")}
      />
      <Checkbox
        id="t-image"
        checked={!!state.image_rights}
        onChange={(e) => toggle("image_rights", e.target.checked)}
        label={t("consentImage")}
      />
      <Checkbox
        id="t-news"
        checked={!!state.newsletter}
        onChange={(e) => toggle("newsletter", e.target.checked)}
        label={t("consentNewsletter")}
      />
    </div>
  );
}

export function DeletionRequest({ pending }: { pending: boolean }) {
  const t = useTranslations("data");
  const [sent, setSent] = useState(pending);
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  if (sent)
    return (
      <p className="mt-3 rounded bg-gold-soft/60 px-3 py-2 font-semibold" role="status">
        {t("deletePending")}
      </p>
    );
  return confirm ? (
    <div className="mt-3 flex flex-wrap gap-3">
      <Button
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await requestDeletion();
            if (r.ok) setSent(true);
          })
        }
      >
        {t("deleteConfirm")}
      </Button>
      <Button variant="secondary" onClick={() => setConfirm(false)}>
        {t("cancel")}
      </Button>
    </div>
  ) : (
    <Button variant="secondary" className="mt-3" onClick={() => setConfirm(true)}>
      {t("deleteButton")}
    </Button>
  );
}
