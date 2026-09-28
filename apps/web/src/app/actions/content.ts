"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Chess } from "chess.js";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(100);
const i18n = (max: number, min = 0) =>
  z.object({ fr: z.string().trim().min(min).max(max), en: z.string().trim().max(max) });
const LEVEL = z.enum(["discovery", "beginner", "intermediate", "advanced", "competition"]);
const optDate = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined))
  .transform((v) => (v ? new Date(v).toISOString() : null));

/** Positions : FEN valides (chess.js) et solution légale, sinon refus. */
const positionsSchema = z
  .string()
  .max(50_000)
  .transform((s, ctx) => {
    try {
      const v = JSON.parse(s || "[]") as { fen: string; solution?: string[] }[];
      if (!Array.isArray(v) || v.length > 20) throw new Error();
      for (const p of v) {
        const ch = new Chess(p.fen);
        for (const uci of p.solution ?? [])
          ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      }
      return v as unknown as Json;
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid_positions" });
      return z.NEVER;
    }
  });

const SCHEMAS = {
  articles: z.object({
    slug,
    title: i18n(200, 3),
    excerpt: i18n(500),
    body: i18n(50_000),
    tags: z
      .string()
      .max(300)
      .transform((s) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 10),
      ),
    status: z.enum(["draft", "published", "archived"]),
  }),
  media_episodes: z.object({
    series_id: uuid,
    slug,
    season: z.coerce.number().int().min(1).max(50),
    number: z.coerce.number().int().min(1).max(999),
    title: i18n(200, 3),
    description: i18n(5000),
    format: z.enum(["video", "audio", "live"]),
    video_url: z
      .string()
      .trim()
      .max(300)
      .transform((v) => v || null),
    audio_url: z
      .string()
      .trim()
      .max(300)
      .transform((v) => v || null),
    live_at: optDate,
    duration_min: z.coerce
      .number()
      .int()
      .min(0)
      .max(600)
      .transform((v) => v || null),
    language: z.enum(["fr", "en", "fon"]),
    level: LEVEL.nullable().or(z.literal("").transform(() => null)),
    theme: z
      .string()
      .max(40)
      .transform((v) => v || null),
    transcript: z
      .string()
      .max(100_000)
      .transform((v) => v || null),
    positions: positionsSchema,
    status: z.enum(["draft", "published"]),
  }),
  lessons_library: z.object({
    slug,
    level: LEVEL,
    theme: z.enum(["rules", "tactics", "strategy", "openings", "endgames", "competition"]),
    title: i18n(200, 3),
    summary: i18n(500),
    body: i18n(50_000),
    positions: positionsSchema,
    position: z.coerce.number().int().min(0).max(10_000),
    is_premium: z.boolean(),
    status: z.enum(["draft", "published"]),
  }),
  resources: z.object({
    title: i18n(200, 3),
    description: i18n(1000),
    kind: z.enum(["pdf", "worksheet", "pgn", "rules", "video", "link"]),
    url: z
      .string()
      .trim()
      .regex(/^(https:\/\/|\/)\S+$/)
      .max(500),
    level: LEVEL.nullable().or(z.literal("").transform(() => null)),
    language: z.enum(["fr", "en", "fon"]),
    is_premium: z.boolean(),
    status: z.enum(["draft", "published"]),
  }),
} as const;

export type ContentType = keyof typeof SCHEMAS;

function done(type: ContentType) {
  revalidatePath("/admin/contenus");
  revalidatePath(
    type === "articles" || type === "media_episodes" ? "/media" : "/academie",
    "layout",
  );
}

export async function saveContentAction(
  type: ContentType,
  id: string | null,
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const schema = SCHEMAS[type];
  if (!schema || (id && !uuid.safeParse(id).success)) return { ok: false, error: "invalid" };
  const p = schema.safeParse(raw);
  if (!p.success)
    return {
      ok: false,
      error: p.error.issues.some((i) => i.message === "invalid_positions")
        ? "invalid_positions"
        : "invalid",
    };
  const row: Record<string, unknown> = { ...p.data };
  if (type === "articles" || type === "media_episodes") {
    // Date de publication fixée au premier passage en « publié ».
    if (row.status === "published") row.published_at = new Date().toISOString();
  }
  const supabase = await createClient();
  if (id && (type === "articles" || type === "media_episodes")) {
    const { data: prev } = await supabase
      .from(type)
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (prev?.published_at) row.published_at = prev.published_at;
  }
  const q = id
    ? supabase
        .from(type)
        .update(row as never)
        .eq("id", id)
        .select("id")
        .single()
    : supabase
        .from(type)
        .insert(row as never)
        .select("id")
        .single();
  const { data, error } = await q;
  if (error || !data)
    return {
      ok: false,
      error:
        error?.code === "23505" ? "duplicate" : error?.code === "23514" ? "invalid" : "forbidden",
    };
  done(type);
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteContentAction(type: ContentType, id: string): Promise<Result> {
  if (!SCHEMAS[type] || !uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.from(type).delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  done(type);
  return { ok: true };
}

/** Nouveau puzzle : position et solution vérifiées (coups légaux). */
export async function addPuzzleAction(_prev: unknown, form: FormData): Promise<Result | null> {
  const p = z
    .object({
      code: slug,
      fen: z.string().trim().max(120),
      solution: z.string().trim().max(200),
      theme: z
        .string()
        .trim()
        .regex(/^[a-zA-Z]{3,30}$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "invalid" };
  const moves = p.data.solution.split(/[\s,]+/).filter(Boolean);
  if (!moves.length || moves.some((m) => !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)))
    return { ok: false, error: "invalid_solution" };
  try {
    const ch = new Chess(p.data.fen);
    for (const m of moves) ch.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    const supabase = await createClient();
    const { error } = await supabase.from("puzzles").insert({
      code: p.data.code,
      fen: p.data.fen,
      solution: moves,
      theme: p.data.theme,
      mate_in: ch.isCheckmate() ? Math.ceil(moves.length / 2) : null,
    });
    if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : "forbidden" };
  } catch {
    return { ok: false, error: "invalid_solution" };
  }
  revalidatePath("/admin/contenus");
  return { ok: true };
}

export async function togglePuzzleAction(id: string, active: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("puzzles")
    .update({ is_active: active })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/contenus");
  return { ok: true };
}

/** Suggestion en fon : acceptée = terme validé par l'équipe éditoriale (avec un locuteur). */
export async function decideFonAction(id: string, accept: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("glossary_suggestions")
    .select("term_id, term_fon")
    .eq("id", id)
    .maybeSingle();
  if (!s) return { ok: false, error: "forbidden" };
  const { error } = await supabase
    .from("glossary_suggestions")
    .update({ status: accept ? "accepted" : "refused" })
    .eq("id", id);
  if (error) return { ok: false, error: "forbidden" };
  if (accept)
    await supabase
      .from("glossary_terms")
      .update({ term_fon: s.term_fon, fon_status: "validated" })
      .eq("id", s.term_id);
  revalidatePath("/admin/contenus");
  revalidatePath("/academie/lexique");
  return { ok: true };
}
