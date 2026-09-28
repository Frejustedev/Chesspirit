import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { NotificationPrefs } from "@/components/account/notification-prefs";

export const metadata: Metadata = { robots: { index: false } };

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/notifications");
  const t = await getTranslations("notificationsPage");
  const supabase = await createClient();
  const p = session.profile!;
  const [{ data: flag }, { data: items }] = await Promise.all([
    supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "whatsapp_notifications")
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id, channel, template, payload, status, created_at")
      .eq("profile_id", p.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const prefs = {
    email: true,
    sms: true,
    whatsapp: false,
    ...((p.notification_prefs ?? {}) as Record<string, boolean>),
  };
  return (
    <AccountShell
      nav={<AccountNav current="/compte/notifications" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <NotificationPrefs initial={prefs} whatsappAvailable={!!flag?.enabled} />
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("history")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(items ?? []).map((n) => (
            <li key={n.id} className="py-3">
              <p className="text-sm text-stone">
                {formatDateTime(n.created_at, locale)} · {t(`channel.${n.channel}`)} ·{" "}
                {t(`status.${n.status}`)}
              </p>
              <p className="mt-1">{(n.payload as { text?: string } | null)?.text ?? n.template}</p>
            </li>
          ))}
          {!items?.length ? <li className="py-3 text-stone">{t("empty")}</li> : null}
        </ul>
      </section>
    </AccountShell>
  );
}
