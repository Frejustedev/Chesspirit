import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryFilters, DirectoryNav, cleanQuery } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("arbitersTitle") };
}

export default async function ArbitersDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; dep?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("directory");
  const supabase = await createClient();
  let q = supabase
    .from("public_arbiters")
    .select("*")
    .order("verified", { ascending: false })
    .limit(200);
  if (sp.dep && (BENIN_DEPARTMENTS as readonly string[]).includes(sp.dep))
    q = q.eq("department", sp.dep);
  const { data } = await q;
  const needle = cleanQuery(sp.q);
  const rows = (data ?? []).filter(
    (a) =>
      !needle ||
      `${a.display_name} ${a.city ?? ""} ${a.zone ?? ""}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(needle),
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("arbitersTitle")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("arbitersIntro")}</p>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/arbitres" />
      </div>
      <DirectoryFilters base="/annuaire/arbitres" q={sp.q} dep={sp.dep} />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a) => (
          <li key={a.profile_id} className="rounded-[var(--radius-card)] border border-line p-4">
            <p className="font-semibold">
              {a.display_name} {a.is_demo ? <DemoBadge /> : null}
              {a.verified ? (
                <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-onaccent">
                  {t("verified")}
                </span>
              ) : null}
            </p>
            <p className="text-sm text-stone">
              {[a.title ? t(`arbiterTitle.${a.title}`) : null, a.zone ?? a.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {a.availability ? <p className="mt-2 text-sm">{a.availability}</p> : null}
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-6 text-stone">{t("empty")}</p> : null}
      <p className="mt-8 text-sm">
        <Link href="/compte/profil#arbitre" className="font-semibold text-accent hover:underline">
          {t("beListedArbiter")} →
        </Link>
      </p>
    </div>
  );
}
