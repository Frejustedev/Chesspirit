import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryNav } from "@/components/directory/directory-nav";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("jobsTitle") };
}

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { type } = await searchParams;
  const t = await getTranslations("directory");
  const supabase = await createClient();
  let q = supabase
    .from("job_posts")
    .select(
      "id, kind, title, description, city, contract, pay_note, contact, expires_on, created_at, is_demo, organizations(name, slug)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);
  if (type && ["coach", "arbiter", "organizer", "other"].includes(type)) q = q.eq("kind", type);
  const { data: jobs } = await q;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("jobsTitle")}</h1>
          <p className="mt-3 max-w-2xl font-serif text-xl text-stone">{t("jobsIntro")}</p>
        </div>
        <Link
          href="/annuaire/emplois/publier"
          className="inline-flex min-h-11 items-center rounded-full bg-bordeaux px-4 font-semibold text-cream hover:bg-ink"
        >
          {t("postJob")}
        </Link>
      </div>
      <div className="mt-6">
        <DirectoryNav current="/annuaire/emplois" />
      </div>
      <ul className="mt-6 space-y-4">
        {(jobs ?? []).map((j) => (
          <li key={j.id} id={j.id} className="rounded-lg border border-line p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-deep">
              {t(`jobKinds.${j.kind}`)}
              {j.contract ? ` · ${t(`contracts.${j.contract}`)}` : ""}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              {j.title} {j.is_demo ? <DemoBadge /> : null}
            </h2>
            <p className="text-sm text-stone">
              {[
                j.organizations ? j.organizations.name : null,
                j.city,
                formatDate(j.created_at, locale),
                j.expires_on ? t("until", { date: formatDate(j.expires_on, locale) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-3 whitespace-pre-line">{j.description}</p>
            {j.pay_note ? <p className="mt-2 text-sm">{j.pay_note}</p> : null}
            <p className="mt-3 text-sm font-semibold">
              {t("contact")} : {j.contact}
            </p>
          </li>
        ))}
      </ul>
      {!jobs?.length ? <p className="mt-6 text-stone">{t("noJobs")}</p> : null}
    </div>
  );
}
