import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryFilters, DirectoryNav, cleanQuery } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ORG_TYPES } from "@/lib/orgs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("structuresTitle") };
}

export default async function StructuresDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; dep?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("directory");
  const supabase = await createClient();
  let q = supabase
    .from("organizations")
    .select("id, slug, name, type, city, department, verified, is_demo")
    .eq("is_public", true)
    .order("verified", { ascending: false })
    .order("name")
    .limit(300);
  if (sp.dep && (BENIN_DEPARTMENTS as readonly string[]).includes(sp.dep))
    q = q.eq("department", sp.dep);
  if (sp.type && (ORG_TYPES as readonly string[]).includes(sp.type))
    q = q.eq("type", sp.type as (typeof ORG_TYPES)[number]);
  const needle = cleanQuery(sp.q);
  if (needle) q = q.or(`name.ilike.%${needle}%,city.ilike.%${needle}%`);
  const { data: rows } = await q;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            {t("structuresTitle")}
          </h1>
          <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("structuresIntro")}</p>
        </div>
        <Link
          href="/annuaire/proposer"
          className="inline-flex min-h-11 items-center rounded-full border border-fg/25 px-4 font-semibold hover:bg-surface"
        >
          {t("propose")}
        </Link>
      </div>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/clubs" />
      </div>
      <DirectoryFilters
        base="/annuaire/clubs"
        q={sp.q}
        dep={sp.dep}
        extra={
          <>
            <label htmlFor="d-type" className="sr-only">
              {t("type")}
            </label>
            <select
              id="d-type"
              name="type"
              defaultValue={sp.type ?? ""}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3 sm:flex-none"
            >
              <option value="">{t("allTypes")}</option>
              {ORG_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`orgType.${x}`)}
                </option>
              ))}
            </select>
          </>
        }
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(rows ?? []).map((o) => (
          <li key={o.id}>
            <Link
              href={`/annuaire/structures/${o.slug}`}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-line p-4 hover:border-accent"
            >
              <span className="font-semibold">
                {o.name} {o.is_demo ? <DemoBadge /> : null}
                {o.verified ? (
                  <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-onaccent">
                    {t("verified")}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-stone">
                {t(`orgType.${o.type}`)} · {[o.city, o.department].filter(Boolean).join(", ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!rows?.length ? <p className="mt-6 text-stone">{t("empty")}</p> : null}
    </div>
  );
}
