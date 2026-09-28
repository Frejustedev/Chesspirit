import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administration — journal", robots: { index: false } };

export default async function AdminAudit({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ objet?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/journal");
  if (!admin) redirect({ href: "/admin", locale });
  const { objet } = await searchParams;
  const t = await getTranslations("adminAudit");
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, object_type, object_id, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (objet && /^[a-z_]{2,40}$/.test(objet)) q = q.eq("object_type", objet);
  const { data: logs } = await q;
  const actors = [...new Set((logs ?? []).map((l) => l.actor_user_id).filter(Boolean))] as string[];
  const { data: names } = actors.length
    ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", actors)
    : { data: [] };
  const who = (id: string | null) => {
    if (!id) return t("system");
    const p = names?.find((n) => n.user_id === id);
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-stone">{t("intro")}</p>
      <form action="/admin/journal" className="mt-4 flex gap-2">
        <label htmlFor="a-obj" className="sr-only">
          {t("object")}
        </label>
        <input
          id="a-obj"
          name="objet"
          defaultValue={objet}
          placeholder={t("object")}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 font-mono"
        />
        <button
          type="submit"
          className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
        >
          {t("apply")}
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-stone">
              <th className="py-2 pr-3 font-semibold">{t("when")}</th>
              <th className="py-2 pr-3 font-semibold">{t("who")}</th>
              <th className="py-2 pr-3 font-semibold">{t("action")}</th>
              <th className="py-2 pr-3 font-semibold">{t("object")}</th>
              <th className="py-2 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="tabular py-2 pr-3">{formatDateTime(l.created_at, locale)}</td>
                <td className="py-2 pr-3">{who(l.actor_user_id)}</td>
                <td className="py-2 pr-3 font-mono">{l.action}</td>
                <td className="py-2 pr-3 font-mono">
                  {l.object_type}
                  {l.object_id ? ` · ${l.object_id.slice(0, 8)}` : ""}
                </td>
                <td className="py-2 font-mono">{l.ip ? String(l.ip) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
