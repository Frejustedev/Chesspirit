/** Schémas Zod partagés entre le client, le serveur et l'application mobile. */
import { z } from "zod";

export const BENIN_DEPARTMENTS = [
  "Alibori",
  "Atacora",
  "Atlantique",
  "Borgou",
  "Collines",
  "Couffo",
  "Donga",
  "Littoral",
  "Mono",
  "Ouémé",
  "Plateau",
  "Zou",
] as const;

export const SEXES = ["M", "F"] as const;
export const LANGUAGES = ["fr", "en", "fon"] as const;

/** Numéro béninois (+229) ou international au format E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .transform((v) => (/^\d{8,10}$/.test(v) ? `+229${v}` : v))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "phone_invalid"));

export const fideIdSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, "fide_id_invalid")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && t < Date.now() && t > Date.parse("1900-01-01");
  }, "date_invalid");

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, "required").max(80),
  last_name: z.string().trim().min(1, "required").max(80),
  birth_date: birthDateSchema,
  sex: z.enum(SEXES),
  city: z.string().trim().min(1, "required").max(80),
  department: z.enum(BENIN_DEPARTMENTS),
  country: z.string().length(2).default("BJ"),
  club_name: z.string().trim().max(120).optional(),
  fide_id: fideIdSchema,
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const consentsSchema = z.object({
  terms: z.literal(true, { message: "terms_required" }),
  newsletter: z.boolean().default(false),
  public_profile: z.boolean().default(false),
  image_rights: z.boolean().default(false),
});
export type ConsentsInput = z.infer<typeof consentsSchema>;

export const childSchema = profileSchema.extend({
  birth_date: birthDateSchema.refine((d) => {
    const b = new Date(`${d}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - b.getUTCFullYear();
    const m = now.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
    return age < 18;
  }, "child_must_be_minor"),
});

export const PAYMENT_METHODS = ["online", "on_site", "free"] as const;

export const registrationSchema = z.object({
  tournament_id: z.string().uuid(),
  player_id: z.string().uuid(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  payment_method: z.enum(PAYMENT_METHODS),
  promo_code: z.string().trim().max(40).optional(),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Champ personnalisé du formulaire d'inscription (stocké en JSON). */
export const customFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.object({ fr: z.string().min(1), en: z.string().min(1) }),
  type: z.enum(["text", "select", "checkbox", "number"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});
export type CustomField = z.infer<typeof customFieldSchema>;

export function answersSchema(fields: CustomField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "number":
        s = z.coerce.number();
        break;
      case "checkbox":
        s = z.coerce.boolean();
        break;
      case "select":
        s = f.options?.length ? z.enum(f.options as [string, ...string[]]) : z.string();
        break;
      default:
        s = z.string().trim().max(200);
    }
    shape[f.key] = f.required
      ? f.type === "text"
        ? (s as z.ZodString).min(1, "required")
        : s
      : s.optional();
  }
  return z.object(shape);
}

export const PAIRING_SYSTEMS = [
  "swiss_dutch",
  "swiss_accelerated",
  "round_robin",
  "double_round_robin",
  "knockout",
  "scheveningen",
  "team_swiss",
  "arena",
  "pools_then_knockout",
  "simul",
] as const;

export const tournamentSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_invalid")
    .max(120),
  venue: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
  base_minutes: z.coerce.number().int().min(1).max(240).optional(),
  increment_seconds: z.coerce.number().int().min(0).max(120).optional(),
  rounds_count: z.coerce.number().int().min(1).max(30).optional(),
  pairing_system: z.enum(PAIRING_SYSTEMS).default("swiss_dutch"),
  entry_fee_xof: z.coerce.number().int().min(0).optional(),
  capacity: z.coerce.number().int().min(2).max(2000).optional(),
  is_online: z.boolean().default(false),
  rated: z.boolean().default(true),
});
export type TournamentInput = z.infer<typeof tournamentSchema>;

/** Ligne d'import du classement final (CSV). */
export const standingImportRowSchema = z.object({
  rank: z.coerce.number().int().min(1),
  name: z.string().trim().min(1),
  points: z.coerce.number().min(0),
  rating: z.coerce
    .number()
    .int()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  club: z.string().trim().optional(),
  fide_id: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});
export type StandingImportRow = z.infer<typeof standingImportRowSchema>;
