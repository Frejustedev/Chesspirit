"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  decideClaimAction,
  moderateJobAction,
  moderateOrganizationAction,
  verifyArbiterAction,
} from "@/app/actions/directory";

export function ModerationButtons({
  kind,
  id,
  isPublic,
  verified,
  status,
}: {
  kind: "claim" | "org" | "job" | "arbiter";
  id: string;
  isPublic?: boolean;
  verified?: boolean;
  status?: string;
}) {
  const t = useTranslations("adminDirectory");
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const btn =
    "min-h-10 rounded-full border border-line px-3 text-sm font-semibold hover:bg-surface";
  return (
    <span className="flex flex-wrap gap-2">
      {kind === "claim" ? (
        <>
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => go(() => decideClaimAction(id, true))}
          >
            {t("approve")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => go(() => decideClaimAction(id, false))}
          >
            {t("refuse")}
          </button>
        </>
      ) : null}
      {kind === "org" ? (
        <>
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => go(() => moderateOrganizationAction(id, { is_public: !isPublic }))}
          >
            {isPublic ? t("hide") : t("publish")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => go(() => moderateOrganizationAction(id, { verified: !verified }))}
          >
            {verified ? t("unverify") : t("verify")}
          </button>
          <button
            type="button"
            className={`${btn} text-accent`}
            disabled={pending}
            onClick={() => {
              if (confirm(t("deleteConfirm")))
                go(() => moderateOrganizationAction(id, { remove: true }));
            }}
          >
            {t("delete")}
          </button>
        </>
      ) : null}
      {kind === "job" ? (
        <>
          {status !== "published" ? (
            <button
              type="button"
              className={btn}
              disabled={pending}
              onClick={() => go(() => moderateJobAction(id, "published"))}
            >
              {t("publish")}
            </button>
          ) : null}
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() =>
              go(() => moderateJobAction(id, status === "published" ? "closed" : "refused"))
            }
          >
            {status === "published" ? t("close") : t("refuse")}
          </button>
        </>
      ) : null}
      {kind === "arbiter" ? (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => go(() => verifyArbiterAction(id, true))}
        >
          {t("verify")}
        </button>
      ) : null}
    </span>
  );
}
