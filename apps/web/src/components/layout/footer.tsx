import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { NAV, LEGAL_NAV, SECONDARY_NAV } from "@/lib/nav";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { NewsletterForm } from "./newsletter-form";

/**
 * Pied de page : le dos du dossier. Extérieur sombre ; les rubriques et la lettre d'information,
 * puis le logotype centré sur son filet d'or, l'adresse du site et la ville, comme la dernière page.
 */
export async function Footer() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const tc = await getTranslations("common");
  const year = new Date().getFullYear();
  const online = await onlinePaymentsEnabled();
  return (
    <footer className="exterieur mt-16 bg-paper text-cream print:hidden">
      <div className="mx-auto max-w-7xl px-4 pt-16 lg:px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <h2 className="label-cs">{tf("newsletter")}</h2>
            <p className="mt-3 font-serif text-lg italic leading-snug text-cream/75">
              {tf("newsletterText")}
            </p>
            <NewsletterForm />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {NAV.map((s) => (
              <div key={s.key}>
                <h2 className="label-cs">{t(`sections.${s.key}`)}</h2>
                <ul className="mt-3 space-y-1">
                  {s.items.slice(0, 4).map((i) => (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className="inline-flex min-h-9 items-center text-[0.95rem] text-cream/75 hover:text-cream"
                      >
                        {t(`items.${i.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Le dos : logotype, filet d'or, adresse. */}
        <div className="mt-20 flex flex-col items-center py-12 text-center">
          <Link
            href="/"
            aria-label={tc("home")}
            className="text-[3.25rem] leading-none sm:text-6xl"
          >
            <Logo tone="light" />
          </Link>
          <span aria-hidden className="mt-7 block h-px w-20 bg-gold" />
          <p className="mt-6 text-cream/70">{tf("site")}</p>
          <p className="text-cream/70">{tf("city")}</p>
          <p className="mt-6 max-w-xl font-serif text-lg italic leading-snug text-cream/60">
            {tf("tagline")}
          </p>
        </div>

        <div className="grid gap-6 border-t border-cream/10 pt-8 text-sm text-cream/65 lg:grid-cols-[1fr_auto]">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {SECONDARY_NAV.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-cream">
                  {t(`items.${i.key}`)}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <span className="text-cream/45">{tf("payments")} </span>
            {online ? `MTN MoMo · Moov Money · Celtiis Cash · ${tf("card")}` : tf("paymentsOnSite")}
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-cream/10 pb-10 pt-6 text-xs text-cream/55 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_NAV.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-cream">
                  {t(`items.${i.key}`)}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            © {year} Chesspirit · {tf("city")} ·{" "}
            {tf.rich("credit", {
              link: (chunks) => (
                <a
                  href="https://frejusteagboton.info"
                  className="text-gold underline-offset-2 hover:underline"
                  rel="noopener"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}
