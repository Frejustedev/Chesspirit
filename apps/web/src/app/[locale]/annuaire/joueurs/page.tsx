import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryFilters, DirectoryNav, cleanQuery } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("playersTitle") };
}

export default async function PlayersDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; dep?: string; titre?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("directory");
  const supabase = await createClient();
  let q = supabase
    .from("public_profiles")
    .select("id, display_name, city, department, club_name, titles, is_demo, verified")
    .order("last_name")
    .limit(200);
  const needle = cleanQuery(sp.q);
  if (needle) q = q.ilike("search_text", `%${needle}%`);
  if (sp.dep && (BENIN_DEPARTMENTS as readonly string[]).includes(sp.dep))
    q = q.eq("department", sp.dep);
  if (sp.titre === "titled") q = q.not("titles", "eq", "{}");
  const { data: rows } = await q;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("playersTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("playersIntro")}</p>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/joueurs" />
      </div>
      <DirectoryFilters
        base="/annuaire/joueurs"
        q={sp.q}
        dep={sp.dep}
        extra={
          <>
            <label htmlFor="d-t" className="sr-only">
              {t("titles")}
            </label>
            <select
              id="d-t"
              name="titre"
              defaultValue={sp.titre ?? ""}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 sm:flex-none"
            >
              <option value="">{t("allPlayers")}</option>
              <option value="titled">{t("titledOnly")}</option>
            </select>
          </>
        }
      />
      <p className="mt-4 text-sm text-stone">{t("count", { n: rows?.length ?? 0 })}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(rows ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/joueurs/${p.id}`}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-3 hover:border-bordeaux"
            >
              <span className="font-semibold">
                {p.titles?.length ? (
                  <span className="mr-1 text-gold-deep">{p.titles.join(" ")}</span>
                ) : null}
                {p.display_name} {p.is_demo ? <DemoBadge /> : null}
              </span>
              <span className="text-sm text-stone">
                {[p.club_name, p.city].filter(Boolean).join(" · ") || "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-stone">{t("privacyNote")}</p>
    </div>
  );
}
