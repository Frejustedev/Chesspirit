"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { addStaffAction, duplicateTournamentAction, removeStaffAction } from "@/app/actions/admin";

type Staff = { id: string; role: string; name: string; phone: string | null };

/** Staff du tournoi (organisateurs, arbitres, opérateurs) et duplication pour l'édition suivante. */
export function StaffPanel({
  tournamentId,
  slug,
  staff,
  canManage,
}: {
  tournamentId: string;
  slug: string;
  staff: Staff[];
  canManage: boolean;
}) {
  const t = useTranslations("staff");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState("deputy_arbiter");
  const [msg, setMsg] = useState<string | null>(null);
  const [dup, setDup] = useState({ slug: `${slug}-${new Date().getFullYear() + 1}`, date: "" });
  const err = (e: string) => (te.has(e) ? te(e) : t.has(`err.${e}`) ? t(`err.${e}`) : e);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                <span className="font-medium">{s.name}</span>{" "}
                <span className="text-sm text-stone">· {t(`role.${s.role}`)}</span>
              </span>
              {canManage ? (
                <button
                  type="button"
                  className="min-h-10 text-sm font-semibold text-accent"
                  onClick={() =>
                    start(async () => {
                      const r = await removeStaffAction(tournamentId, s.id);
                      if (!r.ok) setMsg(err(r.error));
                      router.refresh();
                    })
                  }
                >
                  {t("remove")}
                </button>
              ) : null}
            </li>
          ))}
          {!staff.length ? <li className="py-2 text-stone">{t("none")}</li> : null}
        </ul>
        {canManage ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addStaffAction(tournamentId, identifier, role);
                setMsg(r.ok ? t("added") : err(r.error));
                if (r.ok) {
                  setIdentifier("");
                  router.refresh();
                }
              });
            }}
          >
            <Field id="staff-id" label={t("identifier")} hint={t("identifierHelp")}>
              <Input
                id="staff-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </Field>
            <Field id="staff-role" label={t("roleLabel")}>
              <Select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {["organizer", "chief_arbiter", "deputy_arbiter", "operator"].map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={pending} className="min-h-12">
              {t("add")}
            </Button>
          </form>
        ) : null}
        {msg ? (
          <p role="status" className="mt-2 text-sm font-semibold">
            {msg}
          </p>
        ) : null}
      </section>
      {canManage ? (
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("duplicateTitle")}</h2>
          <p className="mt-2 text-sm text-stone">{t("duplicateHelp")}</p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await duplicateTournamentAction(tournamentId, dup.slug, dup.date);
                if (!r.ok) return setMsg(err(r.error));
                router.push(`/admin/tournois/${r.data!.id}?onglet=reglages`);
              });
            }}
          >
            <Field id="dup-slug" label={t("newSlug")}>
              <Input
                id="dup-slug"
                value={dup.slug}
                onChange={(e) => setDup({ ...dup, slug: e.target.value })}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
            </Field>
            <Field id="dup-date" label={t("newDate")}>
              <Input
                id="dup-date"
                type="date"
                value={dup.date}
                onChange={(e) => setDup({ ...dup, date: e.target.value })}
                required
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={pending}
              className="sm:col-span-2 sm:justify-self-start"
            >
              {t("duplicate")}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
