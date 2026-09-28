import { getTranslations } from "next-intl/server";
import type { levelFor } from "@chesspirit/shared";
import { PieceSvg } from "@/components/icons/pieces";

/** Niveau du membre (Pion → Roi) avec la progression vers le niveau suivant. */
export async function LevelCard({ standing }: { standing: ReturnType<typeof levelFor> }) {
  const t = await getTranslations("community");
  const { level, next, progress, xp, toNext } = standing;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line p-4">
      <PieceSvg
        kind={level.piece}
        color="b"
        className="size-16 shrink-0"
        title={t(`levels.${level.code}`)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-deep">
          {t("myLevel")}
        </p>
        <p className="font-display text-3xl font-semibold">{t(`levels.${level.code}`)}</p>
        <p className="text-sm text-stone">{t("xp", { xp })}</p>
        {next ? (
          <>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-cream"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t("toNext", { n: toNext, level: t(`levels.${next.code}`) })}
            >
              <div
                className="h-full bg-bordeaux"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-sm">
              {t("toNext", { n: toNext, level: t(`levels.${next.code}`) })}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold">{t("maxLevel")}</p>
        )}
      </div>
    </div>
  );
}
