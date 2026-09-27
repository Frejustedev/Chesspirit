// Génère apps/web/src/lib/supabase/types.ts depuis le schéma Postgres (format `supabase gen types`).
// Avec la CLI Supabase : `supabase gen types typescript --local > apps/web/src/lib/supabase/types.ts`.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUT = path.resolve("apps/web/src/lib/supabase/types.ts");

const q = (sql) =>
  JSON.parse(execFileSync("psql", [DB_URL, "-XtAc", sql], { encoding: "utf8" }).trim() || "null") ??
  [];

const enums = q(`select json_agg(json_build_object('name', t.typname, 'values',
  (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
  from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`);

const cols =
  q(`select json_agg(json_build_object('table', c.table_name, 'name', c.column_name, 'type', c.udt_name,
  'nullable', c.is_nullable = 'YES', 'default', c.column_default is not null or c.is_identity = 'YES' or c.is_generated = 'ALWAYS',
  'generated', c.is_generated = 'ALWAYS', 'kind', t.table_type) order by c.table_name, c.ordinal_position)
  from information_schema.columns c join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
  where c.table_schema = 'public' and c.table_name not like '\\_%'`);

const fks = q(`select json_agg(json_build_object('table', tc.relname, 'name', con.conname, 'cols',
  (select json_agg(a.attname) from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k),
  'ref', rc.relname, 'refcols', (select json_agg(a.attname) from unnest(con.confkey) k join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k),
  'unique', exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique and i.indkey::int2[] @> con.conkey and array_length(con.conkey,1) = i.indnatts)))
  from pg_constraint con join pg_class tc on tc.oid = con.conrelid join pg_class rc on rc.oid = con.confrelid
  join pg_namespace n on n.oid = tc.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rc.relnamespace = n.oid`);

const fns =
  q(`select json_agg(json_build_object('name', p.proname, 'args', coalesce((select json_agg(json_build_object('name', a.name, 'type', a.type, 'hasdefault', a.idx >= p.pronargs - p.pronargdefaults) order by a.idx)
    from (select unnest(p.proargnames[1:p.pronargs]) as name, format_type(unnest(p.proargtypes::oid[]), null) as type, generate_subscripts(p.proargtypes::oid[], 1) as idx) a), '[]'),
  'returns', format_type(p.prorettype, null), 'setof', p.proretset,
  'outcols', (select json_agg(json_build_object('name', n, 'type', format_type(t, null)))
     from unnest(p.proargnames, p.proallargtypes::oid[], p.proargmodes) as x(n, t, m) where m = 't')) order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`);

const enumNames = new Set(enums.map((e) => e.name));
function ts(type) {
  const t = type.replace(/^_/, "").replace(/\[\]$/, "");
  const isArr = type.startsWith("_") || type.endsWith("[]");
  let base;
  if (
    [
      "int2",
      "int4",
      "int8",
      "float4",
      "float8",
      "numeric",
      "integer",
      "smallint",
      "bigint",
      "double precision",
      "real",
    ].includes(t)
  )
    base = "number";
  else if (["bool", "boolean"].includes(t)) base = "boolean";
  else if (["json", "jsonb"].includes(t)) base = "Json";
  else if (t.startsWith("public.") && enumNames.has(t.slice(7)))
    base = `Database["public"]["Enums"]["${t.slice(7)}"]`;
  else if (enumNames.has(t)) base = `Database["public"]["Enums"]["${t}"]`;
  else if (t === "void") base = "undefined";
  else base = "string";
  return isArr ? `${base}[]` : base;
}

const byTable = new Map();
for (const c of cols) {
  if (!byTable.has(c.table)) byTable.set(c.table, { kind: c.kind, cols: [] });
  byTable.get(c.table).cols.push(c);
}
const rels = (table) =>
  fks
    .filter((f) => f.table === table)
    .map(
      (f) =>
        `{ foreignKeyName: "${f.name}"; columns: ${JSON.stringify(f.cols)}; isOneToOne: ${f.unique}; referencedRelation: "${f.ref}"; referencedColumns: ${JSON.stringify(f.refcols)} }`,
    );

let out = `// Fichier généré par scripts/gen-types.mjs — ne pas modifier à la main.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
`;
for (const [name, t] of [...byTable].filter(([, t]) => t.kind === "BASE TABLE")) {
  const row = t.cols
    .map((c) => `          ${c.name}: ${ts(c.type)}${c.nullable ? " | null" : ""};`)
    .join("\n");
  const ins = t.cols
    .filter((c) => !c.generated)
    .map(
      (c) =>
        `          ${c.name}${c.nullable || c.default ? "?" : ""}: ${ts(c.type)}${c.nullable ? " | null" : ""};`,
    )
    .join("\n");
  const upd = t.cols
    .filter((c) => !c.generated)
    .map((c) => `          ${c.name}?: ${ts(c.type)}${c.nullable ? " | null" : ""};`)
    .join("\n");
  out += `      ${name}: {\n        Row: {\n${row}\n        };\n        Insert: {\n${ins}\n        };\n        Update: {\n${upd}\n        };\n        Relationships: [${rels(name).join(", ")}];\n      };\n`;
}
out += `    };\n    Views: {\n`;
for (const [name, t] of [...byTable].filter(([, t]) => t.kind === "VIEW")) {
  const row = t.cols.map((c) => `          ${c.name}: ${ts(c.type)} | null;`).join("\n");
  out += `      ${name}: {\n        Row: {\n${row}\n        };\n        Relationships: [];\n      };\n`;
}
out += `    };\n    Functions: {\n`;
const fnGroups = new Map();
for (const f of fns) fnGroups.set(f.name, f);
for (const f of fnGroups.values()) {
  const args = f.args.length
    ? `{ ${f.args.map((a) => `${a.name}${a.hasdefault ? "?" : ""}: ${ts(a.type)}`).join("; ")} }`
    : "Record<PropertyKey, never>";
  let ret;
  if (f.outcols?.length)
    ret = `{ ${f.outcols.map((c) => `${c.name}: ${ts(c.type)}`).join("; ")} }[]`;
  else if (f.returns.startsWith("public.") || byTable.has(f.returns)) {
    const tn = f.returns.replace(/^public\./, "");
    ret = `Database["public"]["Tables"]["${tn}"]["Row"]${f.setof ? "[]" : ""}`;
  } else ret = ts(f.returns) + (f.setof ? "[]" : "");
  out += `      ${f.name}: { Args: ${args}; Returns: ${ret} };\n`;
}
out += `    };\n    Enums: {\n`;
for (const e of enums)
  out += `      ${e.name}: ${e.values.map((v) => JSON.stringify(v)).join(" | ")};\n`;
out += `    };\n    CompositeTypes: Record<string, never>;\n  };\n};\n
type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(
  `✓ Types générés : ${OUT} (${byTable.size} relations, ${fnGroups.size} fonctions, ${enums.length} énumérations)`,
);
