import { Link } from "@/i18n/navigation";
import { DemoBadge } from "@/components/ui/demo-badge";

export function SeasonPicker({
  base,
  seasons,
  current,
  label,
}: {
  base: string;
  seasons: { slug: string; name: string; is_demo: boolean }[];
  current: string;
  label: string;
}) {
  if (seasons.length < 2) return null;
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {seasons.map((s) => (
          <li key={s.slug}>
            <Link
              href={`${base}?saison=${s.slug}`}
              aria-current={s.slug === current ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${s.slug === current ? "bg-gold text-onaccent" : "border border-line hover:bg-surface"}`}
            >
              {s.name} {s.is_demo ? <DemoBadge dark={s.slug === current} /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
