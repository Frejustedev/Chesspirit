import { getTranslations } from "next-intl/server";
import { formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/i18n-json";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { Json } from "@/lib/supabase/types";

export type OfferView = {
  id: string;
  title: Json;
  language: string;
  modality: string;
  level: string;
  format: string;
  duration_min: number;
  price_xof: number;
  coach: { slug: string | null; display_name: string | null; is_demo: boolean | null } | null;
};

export async function OfferCard({ o, locale }: { o: OfferView; locale: string }) {
  const t = await getTranslations("coaching");
  const chip = "rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold";
  return (
    <li className="flex flex-col rounded-lg border border-line bg-paper p-4">
      <p className="font-display text-xl font-semibold">{tr(o.title, locale)}</p>
      {o.coach ? (
        <p className="mt-1 text-sm text-stone">
          {t("with")}{" "}
          <Link
            href={`/coaching/coachs/${o.coach.slug}`}
            className="font-semibold text-ink hover:text-bordeaux"
          >
            {o.coach.display_name}
          </Link>{" "}
          {o.coach.is_demo ? <DemoBadge /> : null}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        <li className={chip}>{t(`lang.${o.language}`)}</li>
        <li className={chip}>{t(`modality.${o.modality}`)}</li>
        <li className={chip}>{t(`level.${o.level}`)}</li>
        <li className={chip}>{t(`format.${o.format}`)}</li>
      </ul>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p>
          <span className="tabular font-display text-2xl font-semibold">
            {o.price_xof ? formatXof(o.price_xof, locale) : t("free")}
          </span>
          <span className="block text-sm text-stone">{t("duration", { min: o.duration_min })}</span>
        </p>
        <Link
          href={`/coaching/reserver/${o.id}`}
          className="inline-flex min-h-11 items-center rounded-full bg-bordeaux px-4 font-semibold text-cream hover:bg-ink"
        >
          {t("book")}
        </Link>
      </div>
    </li>
  );
}

export async function OfferFiltersBar({
  base,
  f,
}: {
  base: string;
  f: Record<string, string | undefined>;
}) {
  const t = await getTranslations("coaching");
  const sel = "min-h-11 rounded-md border border-line bg-white px-3";
  const groups: [string, string, readonly string[], string][] = [
    ["langue", t("filters.language"), ["fr", "en", "fon"], "lang"],
    ["modalite", t("filters.modality"), ["in_person", "online"], "modality"],
    [
      "niveau",
      t("filters.level"),
      ["discovery", "beginner", "intermediate", "advanced", "competition"],
      "level",
    ],
    ["format", t("filters.format"), ["individual", "group"], "format"],
  ];
  return (
    <form action={base} className="grid gap-3 sm:grid-cols-5">
      {groups.map(([name, label, values, ns]) => (
        <div key={name}>
          <label htmlFor={`f-${name}`} className="sr-only">
            {label}
          </label>
          <select
            id={`f-${name}`}
            name={name}
            defaultValue={f[name] ?? ""}
            className={`${sel} w-full`}
          >
            <option value="">{label}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {t(`${ns}.${v}`)}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit" className="min-h-11 rounded-full bg-ink px-4 font-semibold text-cream">
        {t("filters.apply")}
      </button>
    </form>
  );
}
