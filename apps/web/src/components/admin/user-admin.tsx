"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Checkbox, Input } from "@/components/ui/form";
import {
  anonymizeProfileAction,
  mergeProfilesAction,
  setRoleAction,
  setSuspendedAction,
} from "@/app/actions/admin-users";

const ROLES = [
  "player",
  "parent",
  "coach",
  "arbiter",
  "organizer",
  "editor",
  "partner",
  "moderator",
  "admin_competitions",
  "admin_shop",
  "admin",
  "super_admin",
] as const;

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? "error");
    });
  return { pending, error, run };
}

function Err({ code }: { code: string | null }) {
  const t = useTranslations("adminUsers");
  if (!code) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-bordeaux">
      {t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic")}
    </p>
  );
}

export function RolesEditor({
  userId,
  roles,
  canEdit,
}: {
  userId: string;
  roles: string[];
  canEdit: boolean;
}) {
  const t = useTranslations("adminUsers");
  const { pending, error, run } = useAction();
  return (
    <fieldset className="rounded-lg border border-line p-4">
      <legend className="px-1 font-semibold">{t("roles")}</legend>
      {!canEdit ? <p className="mb-2 text-sm text-stone">{t("rolesSuperOnly")}</p> : null}
      <div className="grid grid-cols-2 gap-x-3">
        {ROLES.map((r) => (
          <Checkbox
            key={r}
            id={`role-${r}`}
            checked={roles.includes(r)}
            disabled={!canEdit || pending}
            onChange={(e) => run(() => setRoleAction(userId, r, e.target.checked))}
            label={t(`roleNames.${r}`)}
          />
        ))}
      </div>
      <Err code={error} />
    </fieldset>
  );
}

export function SuspendButton({ profileId, suspended }: { profileId: string; suspended: boolean }) {
  const t = useTranslations("adminUsers");
  const { pending, error, run } = useAction();
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="font-semibold">{t("suspension")}</p>
      <p className="mt-1 text-sm text-stone">{t("suspensionHelp")}</p>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={pending}
        onClick={() => {
          if (!suspended && !confirm(t("suspendConfirm"))) return;
          run(() => setSuspendedAction(profileId, !suspended));
        }}
      >
        {suspended ? t("reactivate") : t("suspend")}
      </Button>
      <Err code={error} />
    </div>
  );
}

export function MergePanel({
  keepId,
  candidates,
  hasAccount,
}: {
  keepId: string;
  candidates: { id: string; label: string; reason: string; hasAccount: boolean }[];
  hasAccount: boolean;
}) {
  const t = useTranslations("adminUsers");
  const { pending, error, run } = useAction();
  const [manual, setManual] = useState("");
  const merge = (id: string) => {
    if (!confirm(t("mergeConfirm"))) return;
    run(() => mergeProfilesAction(keepId, id));
  };
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="font-semibold">{t("duplicates")}</p>
      <p className="mt-1 text-sm text-stone">{t("mergeHelp")}</p>
      {candidates.length ? (
        <ul className="mt-3 space-y-2">
          {candidates.map((c) => (
            <li key={c.id} className="text-sm">
              <Link href={`/admin/utilisateurs/${c.id}`} className="font-semibold underline">
                {c.label}
              </Link>{" "}
              <span className="text-stone">({t(`reasons.${c.reason}`)})</span>
              <button
                type="button"
                disabled={pending || (hasAccount && c.hasAccount)}
                onClick={() => merge(c.id)}
                className="ml-2 min-h-10 rounded-full border border-line px-3 font-semibold disabled:opacity-50"
              >
                {t("mergeHere")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-stone">{t("noDuplicates")}</p>
      )}
      <div className="mt-3 flex gap-2">
        <label htmlFor="merge-id" className="sr-only">
          {t("mergeId")}
        </label>
        <Input
          id="merge-id"
          placeholder={t("mergeId")}
          value={manual}
          onChange={(e) => setManual(e.target.value.trim())}
        />
        <Button
          variant="secondary"
          disabled={pending || !/^[0-9a-f-]{36}$/.test(manual)}
          onClick={() => merge(manual)}
        >
          {t("merge")}
        </Button>
      </div>
      <Err code={error} />
    </div>
  );
}

export function AnonymizeButton({
  profileId,
  requestId,
}: {
  profileId: string;
  requestId?: string;
}) {
  const t = useTranslations("adminUsers");
  const { pending, error, run } = useAction();
  return (
    <div className="rounded-lg border border-bordeaux/40 p-4">
      <p className="font-semibold text-bordeaux">{t("erase")}</p>
      <p className="mt-1 text-sm text-stone">{t("eraseHelp")}</p>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("eraseConfirm"))) return;
          run(() => anonymizeProfileAction(profileId, requestId));
        }}
      >
        {t("eraseButton")}
      </Button>
      <Err code={error} />
    </div>
  );
}
