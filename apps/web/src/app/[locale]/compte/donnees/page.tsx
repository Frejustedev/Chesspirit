import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireSession, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav, AccountShell } from "@/components/account/account-nav";
import { ConsentToggles, DeletionRequest } from "@/components/account/data-controls";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

export default async function DataPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/compte/donnees");
  const t = await getTranslations("data");
  const supabase = await createClient();
  const [{ data: consents }, { data: requests }] = await Promise.all([
    supabase
      .from("consents")
      .select("type, granted, granted_at")
      .eq("profile_id", session.profile!.id)
      .order("granted_at", { ascending: false }),
    supabase
      .from("data_requests")
      .select("type, status, created_at")
      .eq("profile_id", session.profile!.id)
      .order("created_at", { ascending: false }),
  ]);
  const latest: Record<string, boolean> = {};
  for (const c of consents ?? []) if (!(c.type in latest)) latest[c.type] = c.granted;
  return (
    <AccountShell
      nav={<AccountNav current="/compte/donnees" isAdmin={isAdminRole(session.roles)} />}
      title={t("title")}
    >
      <p className="max-w-2xl font-serif text-lg text-stone">{t("intro")}</p>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("consents")}</h2>
        <ConsentToggles initial={latest} minor={session.profile!.is_minor} />
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("export")}</h2>
        <p className="mt-2 text-stone">{t("exportText")}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement d'un fichier, pas une page */}
        <a
          href="/api/me/export"
          className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/25 px-5 font-semibold hover:bg-cream"
        >
          <IconDownload className="size-5" /> {t("exportButton")}
        </a>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("delete")}</h2>
        <p className="mt-2 max-w-2xl text-stone">{t("deleteText")}</p>
        <DeletionRequest
          pending={(requests ?? []).some((r) => r.type === "delete" && r.status === "pending")}
        />
      </section>
    </AccountShell>
  );
}
