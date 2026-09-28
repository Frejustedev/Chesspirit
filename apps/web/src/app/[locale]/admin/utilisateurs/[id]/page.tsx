import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, formatDateTime, formatXof } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { DemoBadge } from "@/components/ui/demo-badge";
import {
  AnonymizeButton,
  MergePanel,
  RolesEditor,
  SuspendButton,
} from "@/components/admin/user-admin";

export const metadata: Metadata = {
  title: "Administration — utilisateur",
  robots: { index: false },
};

export default async function AdminUser({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { admin, session } = await requireStaff(locale, `/admin/utilisateurs/${id}`);
  if (!admin) redirect({ href: "/admin", locale });
  const t = await getTranslations("adminUsers");
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  await supabase.rpc("log_personal_data_access", { p_profile_id: p.id, p_context: "fiche admin" });
  const [
    { data: roles },
    { data: regs },
    { data: orders },
    { data: payments },
    { data: dups },
    { data: children },
    { data: audit },
  ] = await Promise.all([
    p.user_id
      ? supabase.from("user_roles").select("role, scope_id").eq("user_id", p.user_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("registrations")
      .select("id, status, created_at, tournaments(name, slug)")
      .eq("player_id", p.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select("id, number, status, total_xof, created_at")
      .eq("profile_id", p.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, object_type, status, amount_xof, created_at")
      .eq("payer_profile_id", p.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("admin_find_duplicates", { p_profile: p.id }),
    supabase.from("profiles").select("id, first_name, last_name").eq("guardian_id", p.id),
    supabase
      .from("audit_logs")
      .select("id, action, object_type, created_at")
      .eq("object_id", p.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  const superAdmin = session.roles.includes("super_admin");
  const field = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 border-b border-line py-2">
      <dt className="w-40 shrink-0 text-sm text-stone">{label}</dt>
      <dd className="min-w-0 break-words">{value ?? "—"}</dd>
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <Link
        href="/admin/utilisateurs"
        className="text-sm font-semibold text-bordeaux hover:underline"
      >
        ← {t("title")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {p.first_name} {p.last_name} {p.is_demo ? <DemoBadge /> : null}
      </h1>
      {p.merged_into ? (
        <p className="mt-2 rounded bg-bordeaux-soft px-3 py-2 font-semibold text-bordeaux">
          {t("mergedInto")}{" "}
          <Link href={`/admin/utilisateurs/${p.merged_into}`} className="underline">
            {p.merged_into}
          </Link>
        </p>
      ) : null}
      {p.suspended_at ? (
        <p className="mt-2 rounded bg-bordeaux-soft px-3 py-2 font-semibold text-bordeaux">
          {t("suspendedSince", { date: formatDateTime(p.suspended_at, locale) })}
        </p>
      ) : null}
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <dl>
            {field(t("fields.phone"), p.phone)}
            {field(t("fields.email"), p.email)}
            {field(t("fields.birth"), p.birth_date ? formatDate(p.birth_date, locale) : null)}
            {field(t("fields.city"), [p.city, p.department].filter(Boolean).join(", ") || null)}
            {field(t("fields.club"), p.club_name)}
            {field(t("fields.fide"), p.fide_id)}
            {field(t("fields.account"), p.user_id ? t("yes") : t("no"))}
            {field(t("fields.public"), p.is_public ? t("yes") : t("no"))}
            {field(t("fields.source"), p.source)}
            {field(t("fields.created"), formatDateTime(p.created_at, locale))}
            {p.guardian_id
              ? field(
                  t("fields.guardian"),
                  <Link href={`/admin/utilisateurs/${p.guardian_id}`} className="underline">
                    {t("seeGuardian")}
                  </Link>,
                )
              : null}
            {children?.length
              ? field(
                  t("fields.children"),
                  children.map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/utilisateurs/${c.id}`}
                      className="mr-3 underline"
                    >
                      {c.first_name} {c.last_name}
                    </Link>
                  )),
                )
              : null}
          </dl>
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">{t("activity")}</h2>
            <h3 className="mt-3 font-semibold">{t("registrations")}</h3>
            <ul className="text-sm">
              {(regs ?? []).map((r) => (
                <li key={r.id}>
                  {formatDate(r.created_at, locale)} · {r.tournaments?.name} · {r.status}
                </li>
              ))}
              {!regs?.length ? <li className="text-stone">—</li> : null}
            </ul>
            <h3 className="mt-3 font-semibold">{t("orders")}</h3>
            <ul className="text-sm">
              {(orders ?? []).map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/boutique/commandes/${o.id}`} className="underline">
                    {o.number}
                  </Link>{" "}
                  · {o.status} · {formatXof(o.total_xof, locale)}
                </li>
              ))}
              {!orders?.length ? <li className="text-stone">—</li> : null}
            </ul>
            <h3 className="mt-3 font-semibold">{t("payments")}</h3>
            <ul className="text-sm">
              {(payments ?? []).map((x) => (
                <li key={x.id}>
                  {formatDate(x.created_at, locale)} · {x.object_type} · {x.status} ·{" "}
                  {formatXof(x.amount_xof, locale)}
                </li>
              ))}
              {!payments?.length ? <li className="text-stone">—</li> : null}
            </ul>
            <h3 className="mt-3 font-semibold">{t("audit")}</h3>
            <ul className="text-sm">
              {(audit ?? []).map((a) => (
                <li key={a.id}>
                  {formatDateTime(a.created_at, locale)} · {a.action}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="space-y-6">
          {p.user_id ? (
            <RolesEditor
              userId={p.user_id}
              roles={(roles ?? []).filter((r) => !r.scope_id).map((r) => r.role)}
              canEdit={superAdmin}
            />
          ) : null}
          {!p.merged_into ? (
            <>
              <SuspendButton profileId={p.id} suspended={!!p.suspended_at} />
              <MergePanel
                keepId={p.id}
                candidates={(dups ?? []).map((d) => ({
                  id: d.id,
                  label: `${d.first_name} ${d.last_name}${d.birth_date ? ` · ${formatDate(d.birth_date, locale)}` : ""}${d.phone ? ` · ${d.phone}` : ""}`,
                  reason: d.reason,
                  hasAccount: !!d.user_id,
                }))}
                hasAccount={!!p.user_id}
              />
              <AnonymizeButton profileId={p.id} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
