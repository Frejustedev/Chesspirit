/** Petit histogramme horizontal accessible (valeurs aussi en texte). */
export function Bars({
  data,
  format = (n: number) => String(n),
  label,
}: {
  data: Record<string, number>;
  format?: (n: number) => string;
  label: string;
}) {
  const entries = Object.entries(data).sort((a, b) =>
    /^\d{4}-\d{2}$/.test(a[0]) ? a[0].localeCompare(b[0]) : b[1] - a[1],
  );
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-sm text-stone">—</p>;
  return (
    <ul aria-label={label} className="space-y-1.5">
      {entries.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate">{k}</span>
          <span className="h-3 rounded-full bg-surface">
            <span
              className="block h-3 rounded-full bg-bordeaux"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </span>
          <span className="tabular font-semibold">{format(v)}</span>
        </li>
      ))}
    </ul>
  );
}
