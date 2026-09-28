"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@chesspirit/shared";
import { Button, Field } from "@/components/ui/form";
import { bookAction } from "@/app/actions/coaching";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  remaining: number;
};

export function BookingForm({
  offerId,
  slots,
  people,
  paid,
  online,
}: {
  offerId: string;
  slots: Slot[];
  people: { id: string; name: string; self: boolean }[];
  paid: boolean;
  /** Paiement en ligne disponible (sinon un cours payant ne peut pas être réservé en ligne). */
  online: boolean;
}) {
  const t = useTranslations("coaching");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [slot, setSlot] = useState<string | null>(null);
  const [student, setStudent] = useState(people.find((p) => p.self)?.id ?? people[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const days = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = formatDate(s.startsAt, locale, { weekday: "long", day: "numeric", month: "long" });
    days.set(d, [...(days.get(d) ?? []), s]);
  }
  if (!slots.length)
    return (
      <p className="rounded-md border border-dashed border-line p-5 text-stone">{t("noSlots")}</p>
    );
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!slot) return setError(t("chooseSlot"));
        setError(null);
        start(async () => {
          const r = await bookAction({ slotId: slot, offerId, studentId: student, notes });
          if (!r.ok)
            return setError(
              te.has(r.error)
                ? te(r.error)
                : t.has(`err.${r.error}`)
                  ? t(`err.${r.error}`)
                  : te("server"),
            );
          const url = r.data!.redirect;
          window.location.assign(
            url.startsWith("http") ? url : `${locale === "fr" ? "" : `/${locale}`}${url}`,
          );
        });
      }}
    >
      <fieldset>
        <legend className="font-display text-2xl font-semibold">{t("chooseSlot")}</legend>
        <div className="mt-3 space-y-4">
          {[...days.entries()].map(([day, list]) => (
            <div key={day}>
              <p className="text-sm font-semibold first-letter:uppercase">{day}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {list.map((s) => (
                  <label
                    key={s.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 ${slot === s.id ? "border-bordeaux bg-bordeaux text-cream" : "border-line"}`}
                  >
                    <input
                      type="radio"
                      name="slot"
                      value={s.id}
                      className="sr-only"
                      checked={slot === s.id}
                      onChange={() => setSlot(s.id)}
                    />
                    <span className="tabular font-semibold">
                      {formatDate(s.startsAt, locale, { timeStyle: "short" })}
                    </span>
                    {s.location ? <span className="text-sm opacity-80">· {s.location}</span> : null}
                    {s.remaining > 1 ? (
                      <span className="text-xs opacity-80">
                        ({t("places", { n: s.remaining })})
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      {people.length > 1 ? (
        <Field id="student" label={t("forWho")}>
          <select
            id="student"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-md border border-line bg-field px-3"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field id="notes" label={t("notesLabel")} optional={t("optional")}>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-md border border-line bg-field p-3"
        />
      </Field>
      {error ? (
        <p
          role="alert"
          className="rounded bg-bordeaux-soft px-3 py-2 text-sm font-semibold text-rose"
        >
          {error}
        </p>
      ) : null}
      {paid && !online ? (
        <p className="text-sm font-semibold text-accent">{t("onlinePaymentSoon")}</p>
      ) : null}
      <Button type="submit" disabled={pending || (paid && !online)}>
        {paid ? t("bookAndPay") : t("bookFree")}
      </Button>
    </form>
  );
}
