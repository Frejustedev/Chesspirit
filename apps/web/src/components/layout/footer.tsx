import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { NAV, LEGAL_NAV, SECONDARY_NAV } from "@/lib/nav";
import { NewsletterForm } from "./newsletter-form";

export async function Footer() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-ink text-cream">
      <div className="rule-checker !bg-[conic-gradient(var(--color-gold)_25%,transparent_0_50%,var(--color-gold)_0_75%,transparent_0)] opacity-60" />
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Logo tone="light" className="text-4xl" />
            <p className="mt-4 font-serif text-lg leading-snug text-cream/80">{tf("tagline")}</p>
            <div className="mt-8">
              <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold">
                {tf("newsletter")}
              </h2>
              <p className="mt-2 text-sm text-cream/70">{tf("newsletterText")}</p>
              <NewsletterForm />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {NAV.map((s) => (
              <div key={s.key}>
                <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold">
                  {t(`sections.${s.key}`)}
                </h2>
                <ul className="mt-3 space-y-1">
                  {s.items.slice(0, 4).map((i) => (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className="inline-flex min-h-9 items-center text-[0.95rem] text-cream/80 hover:text-cream"
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

        <div className="mt-14 grid gap-6 border-t border-cream/15 pt-8 text-sm text-cream/70 lg:grid-cols-3">
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
            <span className="text-cream/50">{tf("payments")} </span>
            MTN MoMo · Moov Money · Celtiis Cash · {tf("card")}
          </p>
          <p className="lg:text-right">
            {tf("partners")} <span className="text-cream">FSS</span> ·{" "}
            <span className="text-cream">Ayelade Chess</span>
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-cream/15 pt-6 text-xs text-cream/60 lg:flex-row lg:items-center lg:justify-between">
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
            © {year} Chesspirit · Cotonou, Bénin ·{" "}
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
