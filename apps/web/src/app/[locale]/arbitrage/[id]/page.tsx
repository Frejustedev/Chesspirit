import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { OfflineArbiter } from "@/components/admin/offline-arbiter";

export const metadata: Metadata = { title: "Arbitrage hors ligne", robots: { index: false } };

export default async function OfflineArbitragePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireStaff(locale, `/arbitrage/${id}`);
  const t = await getTranslations("offline");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/admin/tournois/${id}?onglet=rondes`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← {t("back")}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-stone">{t("intro")}</p>
      <div className="mt-6">
        <OfflineArbiter tournamentId={id} />
      </div>
    </div>
  );
}
