import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n-json";
import { LEVELS, THEMES } from "@/lib/content";
import {
  ContentEditor,
  PuzzleAdd,
  RowButton,
  type FieldSpec,
} from "@/components/admin/content-editor";
import type { ContentType } from "@/app/actions/content";

export const metadata: Metadata = { title: "Administration — contenus", robots: { index: false } };

const TABS = [
  "articles",
  "media_episodes",
  "lessons_library",
  "resources",
  "puzzles",
  "glossary",
] as const;
type Tab = (typeof TABS)[number];

export default async function AdminContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string; id?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale, "/admin/contenus", { onboarded: false });
  const editor =
    session.roles.includes("editor") ||
    (session.aal === "aal2" &&
      session.roles.some((r) => ["admin", "super_admin", "moderator"].includes(r)));
  if (!editor)
    redirect({
      href: session.roles.length ? "/admin/securite?next=/admin/contenus" : "/compte",
      locale,
    });
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.onglet ?? "")
    ? (sp.onglet as Tab)
    : "articles";
  const t = await getTranslations("adminContent");
  const tc = await getTranslations("coaching");
  const tm = await getTranslations("media");
  const ta = await getTranslations("academy");
  const supabase = await createClient();
  const id = sp.id && /^[0-9a-f-]{36}$/.test(sp.id) ? sp.id : sp.id === "nouveau" ? "new" : null;

  const levelOptions = [
    { value: "", label: "—" },
    ...LEVELS.map((l) => ({ value: l, label: tc(`level.${l}`) })),
  ];
  const statusOptions = (xs: string[]) => xs.map((s) => ({ value: s, label: t(`status.${s}`) }));

  let body: React.ReactNode = null;
  if (tab === "puzzles") {
    const { data: puzzles } = await supabase
      .from("puzzles")
      .select("id, code, theme, mate_in, is_active")
      .order("code");
    body = (
      <div className="space-y-6">
        <PuzzleAdd />
        <ul className="divide-y divide-line border-y border-line">
          {(puzzles ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1 font-mono">{p.code}</span>
              <span className="text-sm text-stone">
                {p.theme}
                {p.mate_in ? ` · ${t("puzzle.mateIn", { n: p.mate_in })}` : ""}
              </span>
              <RowButton
                kind="puzzle"
                id={p.id}
                value={p.is_active}
                label={p.is_active ? t("deactivate") : t("activate")}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (tab === "glossary") {
    const { data: suggestions } = await supabase
      .from("glossary_suggestions")
      .select("id, term_fon, note, glossary_terms(term_fr), profiles(first_name, last_name)")
      .eq("status", "pending")
      .order("created_at");
    body = (
      <div>
        <p className="text-stone">{t("fonHelp")}</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(suggestions ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{s.glossary_terms?.term_fr}</span> →{" "}
                <span className="font-semibold">{s.term_fon}</span>
                <span className="block text-sm text-stone">
                  {s.profiles?.first_name} {s.profiles?.last_name}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </span>
              <RowButton kind="fonAccept" id={s.id} label={t("accept")} />
              <RowButton kind="fonRefuse" id={s.id} label={t("refuse")} />
            </li>
          ))}
          {!suggestions?.length ? <li className="py-3 text-stone">{t("nothing")}</li> : null}
        </ul>
      </div>
    );
  } else {
    const type = tab as ContentType;
    const { data: series } =
      type === "media_episodes"
        ? await supabase.from("media_series").select("id, title").order("position")
        : { data: [] };
    const FIELDS: Record<ContentType, FieldSpec[]> = {
      articles: [
        { name: "slug", kind: "text", label: t("f.slug") },
        {
          name: "status",
          kind: "select",
          label: t("f.status"),
          options: statusOptions(["draft", "published", "archived"]),
        },
        { name: "title", kind: "i18n", label: t("f.title") },
        { name: "excerpt", kind: "i18n", label: t("f.excerpt") },
        { name: "body", kind: "i18nArea", label: t("f.body") },
        { name: "tags", kind: "text", label: t("f.tags") },
      ],
      media_episodes: [
        {
          name: "series_id",
          kind: "select",
          label: t("f.series"),
          options: (series ?? []).map((x) => ({ value: x.id, label: tr(x.title, locale) })),
        },
        {
          name: "status",
          kind: "select",
          label: t("f.status"),
          options: statusOptions(["draft", "published"]),
        },
        { name: "slug", kind: "text", label: t("f.slug") },
        {
          name: "format",
          kind: "select",
          label: t("f.format"),
          options: ["video", "audio", "live"].map((x) => ({ value: x, label: tm(`format.${x}`) })),
        },
        { name: "season", kind: "number", label: t("f.season") },
        { name: "number", kind: "number", label: t("f.number") },
        { name: "title", kind: "i18n", label: t("f.title") },
        { name: "description", kind: "i18nArea", label: t("f.description") },
        { name: "video_url", kind: "url", label: t("f.video") },
        { name: "audio_url", kind: "url", label: t("f.audio") },
        { name: "live_at", kind: "datetime", label: t("f.liveAt") },
        { name: "duration_min", kind: "number", label: t("f.duration") },
        {
          name: "language",
          kind: "select",
          label: t("f.language"),
          options: ["fr", "en", "fon"].map((x) => ({ value: x, label: tm(`lang.${x}`) })),
        },
        { name: "level", kind: "select", label: t("f.level"), options: levelOptions },
        {
          name: "theme",
          kind: "select",
          label: t("f.theme"),
          options: [
            { value: "", label: "—" },
            ...THEMES.map((x) => ({ value: x, label: tm(`themes.${x}`) })),
          ],
        },
        { name: "positions", kind: "json", label: t("f.positions") },
        { name: "transcript", kind: "area", label: t("f.transcript") },
      ],
      lessons_library: [
        { name: "slug", kind: "text", label: t("f.slug") },
        {
          name: "status",
          kind: "select",
          label: t("f.status"),
          options: statusOptions(["draft", "published"]),
        },
        {
          name: "level",
          kind: "select",
          label: t("f.level"),
          options: LEVELS.map((l) => ({ value: l, label: tc(`level.${l}`) })),
        },
        {
          name: "theme",
          kind: "select",
          label: t("f.theme"),
          options: THEMES.map((x) => ({ value: x, label: tm(`themes.${x}`) })),
        },
        { name: "title", kind: "i18n", label: t("f.title") },
        { name: "summary", kind: "i18n", label: t("f.summary") },
        { name: "body", kind: "i18nArea", label: t("f.body") },
        { name: "positions", kind: "json", label: t("f.positions") },
        { name: "position", kind: "number", label: t("f.order") },
        { name: "is_premium", kind: "check", label: t("f.premium") },
      ],
      resources: [
        { name: "title", kind: "i18n", label: t("f.title") },
        { name: "description", kind: "i18n", label: t("f.description") },
        {
          name: "kind",
          kind: "select",
          label: t("f.kind"),
          options: ["pdf", "worksheet", "pgn", "rules", "video", "link"].map((x) => ({
            value: x,
            label: ta(`resourceKind.${x}`),
          })),
        },
        { name: "url", kind: "text", label: t("f.url") },
        { name: "level", kind: "select", label: t("f.level"), options: levelOptions },
        {
          name: "language",
          kind: "select",
          label: t("f.language"),
          options: ["fr", "en", "fon"].map((x) => ({ value: x, label: tm(`lang.${x}`) })),
        },
        {
          name: "status",
          kind: "select",
          label: t("f.status"),
          options: statusOptions(["draft", "published"]),
        },
        { name: "is_premium", kind: "check", label: t("f.premium") },
      ],
    };
    const DEFAULTS: Record<ContentType, Record<string, unknown>> = {
      articles: {
        slug: "",
        status: "draft",
        title: { fr: "", en: "" },
        excerpt: { fr: "", en: "" },
        body: { fr: "", en: "" },
        tags: "",
      },
      media_episodes: {
        series_id: series?.[0]?.id ?? "",
        status: "draft",
        slug: "",
        format: "video",
        season: 1,
        number: 1,
        title: { fr: "", en: "" },
        description: { fr: "", en: "" },
        video_url: "",
        audio_url: "",
        live_at: "",
        duration_min: "",
        language: "fr",
        level: "",
        theme: "",
        positions: "[]",
        transcript: "",
      },
      lessons_library: {
        slug: "",
        status: "draft",
        level: "beginner",
        theme: "tactics",
        title: { fr: "", en: "" },
        summary: { fr: "", en: "" },
        body: { fr: "", en: "" },
        positions: "[]",
        position: 0,
        is_premium: false,
      },
      resources: {
        title: { fr: "", en: "" },
        description: { fr: "", en: "" },
        kind: "pdf",
        url: "",
        level: "",
        language: "fr",
        status: "draft",
        is_premium: false,
      },
    };
    if (id) {
      const row =
        id === "new"
          ? null
          : ((await supabase.from(type).select("*").eq("id", id).maybeSingle()).data as Record<
              string,
              unknown
            > | null);
      const initial: Record<string, unknown> = { ...DEFAULTS[type] };
      if (row)
        for (const k of Object.keys(initial)) {
          const val = row[k];
          initial[k] =
            k === "positions"
              ? JSON.stringify(val ?? [], null, 2)
              : k === "tags"
                ? ((val as string[]) ?? []).join(", ")
                : k === "live_at" && val
                  ? String(val).slice(0, 16)
                  : (val ?? initial[k]);
        }
      body = (
        <div>
          <Link
            href={`/admin/contenus?onglet=${type}`}
            className="text-sm font-semibold text-bordeaux hover:underline"
          >
            ← {t(`tabs.${type}`)}
          </Link>
          <div className="mt-4">
            <ContentEditor
              type={type}
              id={id === "new" ? null : id}
              fields={FIELDS[type]}
              initial={initial}
            />
          </div>
        </div>
      );
    } else {
      const { data: rows } = await supabase
        .from(type)
        .select(type === "resources" ? "id, title, status" : "id, title, status, slug")
        .order("created_at", { ascending: false })
        .limit(200);
      body = (
        <div>
          <Link
            href={`/admin/contenus?onglet=${type}&id=nouveau`}
            className="inline-flex min-h-11 items-center rounded-full bg-bordeaux px-4 font-semibold text-cream hover:bg-ink"
          >
            {t("new")}
          </Link>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {(
              (rows ?? []) as unknown as { id: string; title: { fr?: string }; status: string }[]
            ).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/contenus?onglet=${type}&id=${r.id}`}
                  className="flex justify-between gap-3 py-3 hover:text-bordeaux"
                >
                  <span className="font-semibold">{tr(r.title, locale)}</span>
                  <span className="text-sm text-stone">{t(`status.${r.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("title")} className="-mx-4 mt-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-line">
          {TABS.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/contenus?onglet=${k}`}
                aria-current={tab === k ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 ${tab === k ? "border-bordeaux font-semibold text-bordeaux" : "border-transparent hover:text-bordeaux"}`}
              >
                {t(`tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">{body}</div>
    </div>
  );
}
