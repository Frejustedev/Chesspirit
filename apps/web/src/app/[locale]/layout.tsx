import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Analytics } from "@/components/analytics";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: t("title"), template: `%s · Chesspirit` },
    description: t("description"),
    applicationName: "Chesspirit",
    manifest: "/manifest.webmanifest",
    alternates: { languages: { fr: "/", en: "/en" } },
    openGraph: {
      type: "website",
      siteName: "Chesspirit",
      locale: locale === "en" ? "en_GB" : "fr_BJ",
    },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1c1815",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
