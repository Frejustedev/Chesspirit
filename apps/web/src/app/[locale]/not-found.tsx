import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PieceSvg } from "@/components/icons/pieces";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <PieceSvg kind="k" color="b" className="mx-auto size-20 rotate-90" />
      <h1 className="mt-6 font-display text-5xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("notFoundText")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-bordeaux px-6 font-semibold text-cream hover:bg-ink"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
