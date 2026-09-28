import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { DemoBadge } from "@/components/ui/demo-badge";

export const metadata: Metadata = {
  title: "Administration — utilisateurs",
  robots: { index: false },
};

const PAGE = 50;

export default async function AdminUsers({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; filtre?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/utilisateurs");
  if (!admin) redirect({ href: "/admin", locale });
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const filtre = sp.filtre ?? "";
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const t = await getTranslations("adminUsers");
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, phone, email, city, user_id, is_minor, is_demo, suspended_at, created_at, guardian_id",
      { count: "exact" },
    )
    .is("merged_into", null)
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) {
    const needle = q
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[%_,()]/g, " ");
    query = /^\+?\d{6,}$/.test(q.replace(/\s/g, ""))
      ? query.ilike("phone", `%${q.replace(/\s/g, "")}%`)
      : query.ilike("search_text", `%${needle}%`);
  }
  if (filtre === "suspendus") query = query.not("suspended_at", "is", null);
  if (filtre === "comptes") query = query.not("user_id", "is", null);
  if (filtre === "sans-compte") query = query.is("user_id", null);
  if (filtre === "mineurs") query = query.eq("is_minor", true);
  if (filtre === "demo") query = query.eq("is_demo", true);
  const { data: people, count } = await query;
  await supabase.rpc("log_admin_view", {
    p_object_type: "profiles",
    p_object_id: "list",
    p_context: q ? `recherche:${q}` : "liste",
  });
  const qs = (p: number) =>
    `/admin/utilisateurs?${new URLSearchParams({ ...(q ? { q } : {}), ...(filtre ? { filtre } : {}), page: String(p) })}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <form action="/admin/utilisateurs" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="u-q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="u-q"
          name="q"
          defaultValue={q}
          placeholder={t("search")}
          className="min-h-11 min-w-0 basis-full rounded-md border border-line bg-field px-3 sm:flex-1 sm:basis-auto"
        />
        <label htmlFor="u-f" className="sr-only">
          {t("filter")}
        </label>
        <select
          id="u-f"
          name="filtre"
          defaultValue={filtre}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 sm:flex-none"
        >
          <option value="">{t("filters.all")}</option>
          {(["comptes", "sans-compte", "mineurs", "suspendus", "demo"] as const).map((f) => (
            <option key={f} value={f}>
              {t(`filters.${f}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
        >
          {t("apply")}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone">{t("count", { n: count ?? 0 })}</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {(people ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/utilisateurs/${p.id}`}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
            >
              <span className="min-w-0 flex-1 font-semibold group-hover:text-accent">
                {p.first_name} {p.last_name} {p.is_demo ? <DemoBadge /> : null}
              </span>
              <span className="tabular text-sm">{p.phone ?? p.email ?? "—"}</span>
              <span className="text-sm text-stone">{p.city ?? ""}</span>
              <span className="flex gap-1 text-xs font-semibold">
                {p.user_id ? (
                  <span className="rounded-full bg-surface px-2 py-0.5">{t("badges.account")}</span>
                ) : null}
                {p.is_minor ? (
                  <span className="rounded-full bg-surface px-2 py-0.5">{t("badges.minor")}</span>
                ) : null}
                {p.suspended_at ? (
                  <span className="rounded-full bg-bordeaux px-2 py-0.5 text-cream">
                    {t("badges.suspended")}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-stone">{formatDate(p.created_at, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        {page > 0 ? (
          <Link href={qs(page - 1)} className="font-semibold text-accent hover:underline">
            ← {t("prev")}
          </Link>
        ) : null}
        {(count ?? 0) > (page + 1) * PAGE ? (
          <Link href={qs(page + 1)} className="font-semibold text-accent hover:underline">
            {t("next")} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
