import { getTranslations } from "next-intl/server";
import { formatDate, formatXof } from "@chesspirit/shared";
import { Link } from "@/i18n/navigation";
import type { Tournament } from "@/lib/data/tournaments";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Tbc } from "@/components/ui/tbc";
import { IconArrow } from "@/components/icons";

/** Liste de tournois (calendrier, équipes, direct) ; `suffix` mène à une sous-page (« /direct »). */
export async function TournamentList({
  tournaments,
  locale,
  suffix = "",
}: {
  tournaments: Tournament[];
  locale: string;
  suffix?: string;
}) {
  const tt = await getTranslations("tournament");
  return (
    <ul className="mt-2 divide-y divide-line border-y border-line">
      {tournaments.map((t) => {
        const d = new Date(t.starts_at);
        return (
          <li key={t.id}>
            <Link
              href={`/competitions/${t.slug}${suffix}`}
              className="group grid grid-cols-[4.2rem_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[5rem_1fr_auto]"
            >
              <span className="rounded-[var(--radius-card)] border border-line bg-paper py-2 text-center">
                <span className="block font-display text-3xl font-semibold leading-none">
                  {formatDate(d, locale, { day: "numeric" })}
                </span>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-stone">
                  {formatDate(d, locale, { month: "short" })}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xl font-semibold group-hover:text-accent sm:text-2xl">
                  {t.name} {t.is_demo ? <DemoBadge /> : null}
                </span>
                <span className="mt-0.5 block text-sm text-stone">
                  {[t.city, t.cadence ? tt(`cadence.${t.cadence}`) : null, tt(`status.${t.status}`)]
                    .filter(Boolean)
                    .join(" · ")}
                  {" · "}
                  {t.entry_fee_xof == null || t.unconfirmed_fields.includes("fee") ? (
                    <Tbc />
                  ) : t.entry_fee_xof === 0 ? (
                    tt("free")
                  ) : (
                    formatXof(t.entry_fee_xof, locale)
                  )}
                </span>
              </span>
              <IconArrow className="size-5 text-stone group-hover:text-accent" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
