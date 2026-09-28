import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { ModerationButtons } from "@/components/admin/directory-admin";

export const metadata: Metadata = { title: "Administration — annuaire", robots: { index: false } };

export default async function AdminDirectory({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/annuaire");
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminDirectory");
  const td = await getTranslations("directory");
  const supabase = await createClient();
  const [{ data: orgs }, { data: claims }, { data: jobs }, { data: arbiters }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, slug, name, type, city, is_public, verified, created_at")
      .or("is_public.eq.false,verified.eq.false")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("listing_claims")
      .select(
        "id, role_in_org, message, status, created_at, organizations(name, slug), profiles(first_name, last_name, phone)",
      )
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("job_posts")
      .select("id, title, kind, status, created_at, contact")
      .in("status", ["pending", "published"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("arbiter_profiles")
      .select("profile_id, title, zone, verified, profiles(first_name, last_name)")
      .eq("verified", false)
      .limit(100),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("claims")}</h2>
        <ul className="mt-3 space-y-3">
          {(claims ?? []).map((c) => (
            <li key={c.id} className="rounded-md border border-line p-3">
              <p className="font-semibold">
                {c.profiles?.first_name} {c.profiles?.last_name} ({c.profiles?.phone ?? "—"}) →{" "}
                <Link href={`/annuaire/structures/${c.organizations?.slug}`} className="underline">
                  {c.organizations?.name}
                </Link>
              </p>
              <p className="text-sm text-stone">
                {c.role_in_org} · {formatDate(c.created_at, locale)}
              </p>
              {c.message ? <p className="mt-1 text-sm">{c.message}</p> : null}
              <ModerationButtons kind="claim" id={c.id} />
            </li>
          ))}
          {!claims?.length ? <li className="text-sm text-stone">{t("none")}</li> : null}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("structures")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(orgs ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link
                href={`/annuaire/structures/${o.slug}`}
                className="min-w-0 flex-1 font-semibold underline"
              >
                {o.name}
              </Link>
              <span className="text-sm text-stone">
                {td(`orgType.${o.type}`)} · {o.city ?? "—"} ·{" "}
                {o.is_public ? t("public") : t("hidden")} ·{" "}
                {o.verified ? t("verified") : t("notVerified")}
              </span>
              <ModerationButtons
                kind="org"
                id={o.id}
                isPublic={o.is_public}
                verified={o.verified}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("jobs")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(jobs ?? []).map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1 font-semibold">{j.title}</span>
              <span className="text-sm text-stone">
                {td(`jobKinds.${j.kind}`)} · {t(`jobStatus.${j.status}`)} · {j.contact}
              </span>
              <ModerationButtons kind="job" id={j.id} status={j.status} />
            </li>
          ))}
          {!jobs?.length ? <li className="py-3 text-sm text-stone">{t("none")}</li> : null}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("arbiters")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(arbiters ?? []).map((a) => (
            <li key={a.profile_id} className="flex flex-wrap items-center gap-3 py-3">
              <Link
                href={`/admin/utilisateurs/${a.profile_id}`}
                className="min-w-0 flex-1 font-semibold underline"
              >
                {a.profiles?.first_name} {a.profiles?.last_name}
              </Link>
              <span className="text-sm text-stone">
                {a.title ? td(`arbiterTitle.${a.title}`) : "—"} · {a.zone ?? "—"}
              </span>
              <ModerationButtons kind="arbiter" id={a.profile_id} />
            </li>
          ))}
          {!arbiters?.length ? <li className="py-3 text-sm text-stone">{t("none")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
