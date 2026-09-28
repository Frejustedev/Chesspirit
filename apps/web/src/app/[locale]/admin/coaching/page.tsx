import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ApplicationButtons,
  CoachStatus,
  CommissionSettings,
} from "@/components/admin/coaching-admin";

export const metadata: Metadata = { title: "Administration — coaching", robots: { index: false } };

export default async function AdminCoaching({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin, session } = await requireStaff(locale, "/admin/coaching");
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminCoaching");
  const supabase = await createClient();
  const [{ data: apps }, { data: coaches }, { data: quotes }, { data: settings }] =
    await Promise.all([
      supabase
        .from("coach_applications")
        .select(
          "id, experience, languages, modalities, city, status, created_at, profiles(first_name, last_name, phone)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("coach_profiles")
        .select("id, slug, status, is_chesspirit, profiles(first_name, last_name)")
        .order("created_at"),
      supabase
        .from("quote_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["coaching_commission_enabled", "coaching_commission_rate"]),
    ]);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value;
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 lg:px-6">
      <div>
        <nav className="text-sm text-stone">
          <Link href="/admin" className="hover:text-accent">
            {t("back")}
          </Link>
        </nav>
        <h1 className="mt-2 font-display text-4xl font-semibold">{t("title")}</h1>
      </div>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("commission")}</h2>
        <CommissionSettings
          enabled={setting("coaching_commission_enabled") !== false}
          rate={Number(setting("coaching_commission_rate") ?? 0.15)}
          canEdit={session.roles.includes("super_admin")}
        />
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("applications")}</h2>
        <ul className="mt-3 space-y-3">
          {(apps ?? []).map((a) => (
            <li key={a.id} className="rounded-md border border-line p-3">
              <p className="font-semibold">
                {a.profiles?.first_name} {a.profiles?.last_name}{" "}
                <span className="text-sm text-stone">
                  · {a.profiles?.phone} · {a.city}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{a.experience}</p>
              <p className="mt-1 text-xs text-stone">
                {formatDate(a.created_at, locale)} · {t(`appStatus.${a.status}`)}
              </p>
              {a.status === "pending" ? <ApplicationButtons id={a.id} /> : null}
            </li>
          ))}
          {!apps?.length ? <li className="text-stone">{t("none")}</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("coaches")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(coaches ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
              <Link
                href={`/coaching/coachs/${c.slug}`}
                className="flex-1 font-medium hover:text-accent"
              >
                {c.profiles?.first_name} {c.profiles?.last_name}
              </Link>
              <CoachStatus id={c.id} status={c.status} team={c.is_chesspirit} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">{t("quotes")}</h2>
        <ul className="mt-3 space-y-2">
          {(quotes ?? []).map((q) => (
            <li key={q.id} className="rounded-md border border-line p-3 text-sm">
              <p className="font-semibold">
                {q.organization} · {t(`kind.${q.kind}`)} · {q.participants ?? "?"}{" "}
                {t("participants")}
              </p>
              <p>
                {q.contact_name} · {q.phone ?? ""} {q.email ?? ""} · {q.city ?? ""}
              </p>
              {q.message ? (
                <p className="mt-1 whitespace-pre-line text-stone">{q.message}</p>
              ) : null}
            </li>
          ))}
          {!quotes?.length ? <li className="text-stone">{t("none")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
