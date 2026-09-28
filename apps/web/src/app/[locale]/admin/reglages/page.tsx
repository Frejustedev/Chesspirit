import { tr } from "@/lib/i18n-json";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { FlagToggle, SettingEditor } from "@/components/admin/misc-admin";

export const metadata: Metadata = { title: "Administration — réglages", robots: { index: false } };

export default async function AdminSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin, session } = await requireStaff(locale, "/admin/reglages");
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminSettings");
  const supabase = await createClient();
  const [{ data: settings }, { data: flags }, { data: countries }] = await Promise.all([
    supabase.from("app_settings").select("key, value, description, is_public").order("key"),
    supabase.from("feature_flags").select("key, enabled, description").order("key"),
    supabase
      .from("countries")
      .select("code, name, currency, phone_prefix, enabled")
      .order("position"),
  ]);
  const canEdit = session.roles.includes("super_admin");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      {!canEdit ? <p className="mt-2 text-stone">{t("superOnly")}</p> : null}
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("flags")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(flags ?? []).map((f) => (
            <li key={f.key} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-semibold">{f.key}</span>
                <span className="block text-sm text-stone">{f.description}</span>
              </span>
              <FlagToggle flag={f.key} enabled={f.enabled} disabled={!canEdit} />
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("countries")}</h2>
        <p className="mt-1 text-sm text-stone">{t("countriesHelp")}</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(countries ?? []).map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {tr(c.name, locale)}{" "}
                  <span className="font-mono text-sm text-stone">{c.code}</span>
                </span>
                <span className="block text-sm text-stone">
                  {c.phone_prefix} · {c.currency}
                </span>
              </span>
              <FlagToggle
                kind="country"
                flag={c.code}
                enabled={c.enabled}
                disabled={!canEdit || c.code === "BJ"}
              />
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("settings")}</h2>
        <p className="mt-1 text-sm text-stone">{t("settingsHelp")}</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(settings ?? []).map((s) => (
            <li key={s.key} className="py-3">
              <p className="font-mono text-sm font-semibold">
                {s.key}{" "}
                {s.is_public ? <span className="font-sans text-stone">· {t("public")}</span> : null}
              </p>
              <p className="text-sm text-stone">{s.description}</p>
              <SettingEditor
                settingKey={s.key}
                value={JSON.stringify(s.value)}
                disabled={!canEdit}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
