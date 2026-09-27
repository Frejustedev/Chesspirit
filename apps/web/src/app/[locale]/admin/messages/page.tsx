import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDateTime } from "@chesspirit/shared";
import { Link, redirect } from "@/i18n/navigation";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { StatusSelect } from "@/components/admin/misc-admin";

export const metadata: Metadata = { title: "Administration — messages", robots: { index: false } };

const TABS = ["contact", "donnees", "devis"] as const;

export default async function AdminMessages({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { admin } = await requireStaff(locale, "/admin/messages");
  if (!admin) redirect({ href: "/admin", locale });
  const { onglet } = await searchParams;
  const tab = (TABS as readonly string[]).includes(onglet ?? "") ? onglet! : "contact";
  const t = await getTranslations("adminMessages");
  const supabase = await createClient();
  const [{ data: messages }, { data: requests }, { data: quotes }] = await Promise.all([
    tab === "contact"
      ? supabase
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: null }),
    tab === "donnees"
      ? supabase
          .from("data_requests")
          .select("*, profiles(first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: null }),
    tab === "devis"
      ? supabase
          .from("quote_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: null }),
  ]);
  await supabase.rpc("log_admin_view", {
    p_object_type:
      tab === "contact"
        ? "contact_messages"
        : tab === "donnees"
          ? "data_requests"
          : "quote_requests",
    p_object_id: "list",
    p_context: "messages",
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("title")} className="-mx-4 mt-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-line">
          {TABS.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/messages?onglet=${k}`}
                aria-current={tab === k ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 ${tab === k ? "border-bordeaux font-semibold text-bordeaux" : "border-transparent hover:text-bordeaux"}`}
              >
                {t(`tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="mt-6 space-y-4">
        {(messages ?? []).map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">{m.name}</p>
              <p className="text-sm text-stone">
                {[m.phone, m.email, m.topic].filter(Boolean).join(" · ")} ·{" "}
                {formatDateTime(m.created_at, locale)}
              </p>
              <span className="ml-auto">
                <StatusSelect kind="contact" id={m.id} value={m.status} />
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line">{m.message}</p>
          </li>
        ))}
        {(requests ?? []).map((r) => (
          <li key={r.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/utilisateurs/${r.profile_id}`}
                className="font-semibold underline"
              >
                {r.profiles?.first_name} {r.profiles?.last_name}
              </Link>
              <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold">
                {t(`requestTypes.${r.type}`)}
              </span>
              <span className="text-sm text-stone">{formatDateTime(r.created_at, locale)}</span>
              <span className="ml-auto">
                <StatusSelect kind="data" id={r.id} value={r.status} />
              </span>
            </div>
            {r.details ? <p className="mt-2 whitespace-pre-line">{r.details}</p> : null}
            <p className="mt-2 text-sm text-stone">{t(`requestHelp.${r.type}`)}</p>
          </li>
        ))}
        {(quotes ?? []).map((q) => (
          <li key={q.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">
                {q.organization} · {q.contact_name}
              </p>
              <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold">
                {q.kind}
              </span>
              <p className="text-sm text-stone">
                {[q.phone, q.email, q.city].filter(Boolean).join(" · ")} ·{" "}
                {formatDateTime(q.created_at, locale)}
              </p>
              <span className="ml-auto">
                <StatusSelect kind="quote" id={q.id} value={q.status} />
              </span>
            </div>
            {q.message ? <p className="mt-2 whitespace-pre-line">{q.message}</p> : null}
          </li>
        ))}
        {!(messages ?? requests ?? quotes)?.length ? (
          <li className="text-stone">{t("empty")}</li>
        ) : null}
      </ul>
    </div>
  );
}
