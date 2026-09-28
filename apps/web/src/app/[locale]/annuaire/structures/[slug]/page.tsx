import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ClaimForm } from "@/components/directory/directory-forms";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const o = await load(slug);
  return o ? { title: o.name, description: o.description?.slice(0, 160) } : {};
}

export default async function StructurePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const o = await load(slug);
  if (!o) notFound();
  const t = await getTranslations("directory");
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: tournaments }, { data: claim }, { data: jobs }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("slug, name, starts_at")
      .eq("organization_id", o.id)
      .neq("status", "draft")
      .order("starts_at", { ascending: false })
      .limit(10),
    session?.profile
      ? supabase
          .from("listing_claims")
          .select("status")
          .eq("organization_id", o.id)
          .eq("profile_id", session.profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("job_posts")
      .select("id, title")
      .eq("organization_id", o.id)
      .eq("status", "published"),
  ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <Link href="/annuaire/clubs" className="text-sm font-semibold text-bordeaux hover:underline">
        ← {t("structuresTitle")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {o.name} {o.is_demo ? <DemoBadge /> : null}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-stone">
        {t(`orgType.${o.type}`)} · {[o.city, o.department].filter(Boolean).join(", ")}
        {o.verified ? (
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-cream">
            {t("verified")}
          </span>
        ) : null}
        {!o.is_public ? (
          <span className="text-sm font-semibold text-bordeaux">{t("pendingReview")}</span>
        ) : null}
      </p>
      {o.description ? (
        <p className="mt-6 whitespace-pre-line font-serif text-lg">{o.description}</p>
      ) : null}
      <dl className="mt-6 grid gap-2 sm:grid-cols-2">
        {o.address ? (
          <div>
            <dt className="text-sm text-stone">{t("address")}</dt>
            <dd>{o.address}</dd>
          </div>
        ) : null}
        {o.phone ? (
          <div>
            <dt className="text-sm text-stone">{t("phone")}</dt>
            <dd>
              <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="underline">
                {o.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {o.email ? (
          <div>
            <dt className="text-sm text-stone">{t("email")}</dt>
            <dd>
              <a href={`mailto:${o.email}`} className="underline">
                {o.email}
              </a>
            </dd>
          </div>
        ) : null}
        {o.website ? (
          <div>
            <dt className="text-sm text-stone">{t("website")}</dt>
            <dd>
              <a
                href={o.website}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="underline"
              >
                {o.website.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {o.lat && o.lng ? (
        <p className="mt-4">
          <Link
            href={`/annuaire/carte?focus=${o.slug}`}
            className="font-semibold text-bordeaux hover:underline"
          >
            {t("seeOnMap")} →
          </Link>
        </p>
      ) : null}
      {tournaments?.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("tournaments")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {tournaments.map((x) => (
              <li key={x.slug} className="flex justify-between gap-3 py-2">
                <Link
                  href={`/competitions/${x.slug}`}
                  className="font-semibold hover:text-bordeaux"
                >
                  {x.name}
                </Link>
                <span className="text-sm text-stone">{formatDate(x.starts_at, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {jobs?.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("jobsHere")}</h2>
          <ul className="mt-2 list-disc pl-5">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/annuaire/emplois#${j.id}`} className="underline">
                  {j.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!o.claimed_by ? (
        <section className="mt-10 rounded-lg border border-line p-5">
          <h2 className="font-display text-2xl font-semibold">{t("claimTitle")}</h2>
          <p className="mt-1 text-stone">{t("claimText")}</p>
          {claim ? (
            <p className="mt-3 font-semibold">{t(`claimStatus.${claim.status}`)}</p>
          ) : session?.profile ? (
            <ClaimForm organizationId={o.id} />
          ) : (
            <Link
              href={`/connexion?next=${encodeURIComponent(`/annuaire/structures/${o.slug}`)}`}
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-bordeaux hover:underline"
            >
              {t("signInToClaim")} →
            </Link>
          )}
        </section>
      ) : null}
    </div>
  );
}
