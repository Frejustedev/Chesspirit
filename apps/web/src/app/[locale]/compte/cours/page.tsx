import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { currentTime } from "@/lib/time";
import { BookingActions, HomeworkToggle } from "@/components/coaching/student-actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyLessons({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/cours");
  const t = await getTranslations("myLessons");
  const supabase = await createClient();
  const [{ data: bookings }, { data: homework }, { data: notes }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, amount_xof, meeting_url, offers(title), availability_slots(starts_at, location), coach_profiles(slug)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("homework")
      .select("id, title, details, due_on, done_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("progress_notes")
      .select("id, note, level, replay_url, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const now = currentTime();
  return (
    <AccountShell
      nav={<AccountNav current="/compte/cours" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("planning")}</h2>
        {bookings?.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {bookings.map((b) => {
              const at = b.availability_slots?.starts_at;
              const upcoming = at && Date.parse(at) > now;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {tr(b.offers?.title ?? null, locale)}
                    </span>
                    <span className="block text-sm text-stone">
                      {at ? formatDateTime(at, locale) : ""} · {t(`status.${b.status}`)} ·{" "}
                      {formatXof(b.amount_xof, locale)}
                    </span>
                    {b.meeting_url && b.status === "confirmed" && upcoming ? (
                      <a
                        href={b.meeting_url}
                        className="text-sm font-semibold text-bordeaux underline"
                        rel="noopener"
                      >
                        {t("join")}
                      </a>
                    ) : b.availability_slots?.location ? (
                      <span className="text-sm">{b.availability_slots.location}</span>
                    ) : null}
                  </span>
                  {upcoming && ["confirmed", "pending_payment"].includes(b.status) ? (
                    <BookingActions id={b.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-stone">
            {t("none")}{" "}
            <Link href="/coaching" className="font-semibold text-bordeaux hover:underline">
              {t("browse")}
            </Link>
          </p>
        )}
      </section>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("homework")}</h2>
          <ul className="mt-3 space-y-2">
            {(homework ?? []).map((h) => (
              <li key={h.id} className="rounded-md border border-line p-3">
                <HomeworkToggle id={h.id} done={!!h.done_at} label={h.title} />
                {h.due_on ? (
                  <p className="text-sm text-stone">{t("due", { date: h.due_on })}</p>
                ) : null}
              </li>
            ))}
            {!homework?.length ? <li className="text-stone">{t("noHomework")}</li> : null}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("notes")}</h2>
          <ul className="mt-3 space-y-2">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="rounded-md border border-line p-3">
                <p className="whitespace-pre-line">{n.note}</p>
                {n.replay_url ? (
                  <a
                    href={n.replay_url}
                    className="text-sm font-semibold text-bordeaux underline"
                    rel="noopener"
                  >
                    {t("replay")}
                  </a>
                ) : null}
              </li>
            ))}
            {!notes?.length ? <li className="text-stone">{t("noNotes")}</li> : null}
          </ul>
        </section>
      </div>
    </AccountShell>
  );
}
