import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fide");
  return { title: t("title") };
}

/** Elo FIDE des joueurs (profils publics avec identifiant FIDE), importé chaque mois. */
export default async function FidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("fide");
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name, fide_id, club_name, titles")
    .not("fide_id", "is", null);
  const ids = (profiles ?? []).map((p) => p.fide_id!);
  const { data: fide } = ids.length
    ? await supabase
        .from("fide_ratings")
        .select("*")
        .in("fide_id", ids)
        .order("period", { ascending: false })
    : { data: [] };
  const latest = new Map<string, NonNullable<typeof fide>[number]>();
  for (const f of fide ?? []) if (!latest.has(f.fide_id)) latest.set(f.fide_id, f);
  const rows = (profiles ?? [])
    .map((p) => ({ ...p, f: latest.get(p.fide_id!) }))
    .sort((a, b) => (b.f?.standard ?? 0) - (a.f?.standard ?? 0));
  const period = [...latest.values()][0]?.period;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      {period ? <p className="mt-2 text-sm text-stone">{t("period", { period })}</p> : null}
      {rows.some((r) => r.f) ? (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
            <thead className="bg-cream/70 text-xs uppercase tracking-[0.08em] text-stone">
              <tr>
                <th className="px-3 py-2">{t("player")}</th>
                <th className="px-3 py-2">FIDE ID</th>
                <th className="px-3 py-2 text-right">{t("standard")}</th>
                <th className="px-3 py-2 text-right">{t("rapid")}</th>
                <th className="px-3 py-2 text-right">{t("blitz")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/joueurs/${r.id}`} className="hover:text-bordeaux">
                      {r.display_name}
                    </Link>
                  </td>
                  <td className="tabular px-3 py-2">{r.fide_id}</td>
                  <td className="tabular px-3 py-2 text-right">{r.f?.standard ?? "—"}</td>
                  <td className="tabular px-3 py-2 text-right">{r.f?.rapid ?? "—"}</td>
                  <td className="tabular px-3 py-2 text-right">{r.f?.blitz ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line p-6 font-serif text-lg text-stone">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
