import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BENIN_DEPARTMENTS } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DemoBadge } from "@/components/ui/demo-badge";
import { RankingTabs } from "@/components/rankings/ranking-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rankings");
  return { title: t("title"), description: t("intro") };
}

const TYPES = ["rapid", "blitz", "classical"] as const;
const AGES = ["all", "u14", "u18", "o50"] as const;

type SP = { cadence?: string; sexe?: string; age?: string; dep?: string; q?: string };

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("rankings");
  const tt = await getTranslations("tournament");
  const type = (TYPES as readonly string[]).includes(sp.cadence ?? "")
    ? (sp.cadence as (typeof TYPES)[number])
    : "rapid";
  const supabase = await createClient();
  let q = supabase
    .from("public_ratings")
    .select("*")
    .eq("type", type)
    .order("rating", { ascending: false })
    .limit(200);
  if (sp.sexe === "F" || sp.sexe === "M") q = q.eq("sex", sp.sexe);
  if (sp.dep && (BENIN_DEPARTMENTS as readonly string[]).includes(sp.dep))
    q = q.eq("department", sp.dep);
  const year = new Date().getFullYear();
  if (sp.age === "u14") q = q.gt("birth_year", year - 14);
  if (sp.age === "u18") q = q.gt("birth_year", year - 18);
  if (sp.age === "o50") q = q.lt("birth_year", year - 50);
  if (sp.q) q = q.ilike("display_name", `%${sp.q.replace(/[%_]/g, "")}%`);
  const { data } = await q;
  const href = (patch: Partial<SP>) => {
    const u = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v && v !== "all") as [string, string][],
    );
    return `/classements${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <RankingTabs current="chesspirit" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("intro")}</p>
      <nav aria-label={t("cadences")} className="mt-6 flex flex-wrap gap-2">
        {TYPES.map((c) => (
          <Link
            key={c}
            href={href({ cadence: c })}
            aria-current={c === type ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${c === type ? "border-bordeaux bg-bordeaux text-cream" : "border-line hover:border-accent"}`}
          >
            {tt(`cadence.${c}`)}
          </Link>
        ))}
      </nav>
      <form className="mt-4 grid gap-3 sm:grid-cols-4" action="/classements">
        <input type="hidden" name="cadence" value={type} />
        <label className="sr-only" htmlFor="q">
          {t("search")}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={sp.q}
          placeholder={t("search")}
          className="min-h-11 rounded-md border border-line bg-field px-3"
        />
        <label className="sr-only" htmlFor="sexe">
          {t("sex")}
        </label>
        <select
          id="sexe"
          name="sexe"
          defaultValue={sp.sexe ?? ""}
          className="min-h-11 rounded-md border border-line bg-field px-3"
        >
          <option value="">{t("allSexes")}</option>
          <option value="F">{t("women")}</option>
          <option value="M">{t("men")}</option>
        </select>
        <label className="sr-only" htmlFor="age">
          {t("age")}
        </label>
        <select
          id="age"
          name="age"
          defaultValue={sp.age ?? "all"}
          className="min-h-11 rounded-md border border-line bg-field px-3"
        >
          {AGES.map((a) => (
            <option key={a} value={a}>
              {t(`ages.${a}`)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="dep">
            {t("department")}
          </label>
          <select
            id="dep"
            name="dep"
            defaultValue={sp.dep ?? ""}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-field px-3"
          >
            <option value="">{t("allDepartments")}</option>
            {BENIN_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-gold px-4 font-semibold text-onaccent"
          >
            {t("filter")}
          </button>
        </div>
      </form>
      {data?.length ? (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[30rem] text-left text-[0.95rem]">
            <thead className="bg-surface/70 text-xs uppercase tracking-[0.08em] text-stone">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t("player")}</th>
                <th className="px-3 py-2">{t("club")}</th>
                <th className="px-3 py-2 text-right">{t("rating")}</th>
                <th className="px-3 py-2 text-right">{t("games")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((r, i) => (
                <tr key={r.profile_id}>
                  <td className="tabular px-3 py-2 text-accent">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {r.titles?.length ? (
                      <span className="mr-1.5 text-xs font-bold text-accent">
                        {r.titles.join(" ")}
                      </span>
                    ) : null}
                    <Link
                      href={`/joueurs/${r.profile_id}`}
                      className="hover:text-accent hover:underline"
                    >
                      {r.display_name}
                    </Link>{" "}
                    {r.is_demo ? <DemoBadge /> : null}
                  </td>
                  <td className="px-3 py-2 text-stone">{r.club_name ?? ""}</td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{r.rating}</td>
                  <td className="tabular px-3 py-2 text-right text-stone">{r.games}</td>
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
      <p className="mt-4 text-sm text-stone">
        {t("note")}{" "}
        <Link href="/classements/methode" className="font-semibold text-accent hover:underline">
          {t("methodLink")}
        </Link>
      </p>
    </div>
  );
}
