import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import { PieceSvg } from "@/components/icons/pieces";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if (await getSession()) redirect({ href: target, locale });
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:px-6">
      <div className="hidden lg:block">
        <div className="flex gap-3">
          <PieceSvg kind="k" color="w" className="size-20" />
          <PieceSvg kind="n" color="b" className="size-20" />
        </div>
        <h1 className="mt-6 font-display text-5xl font-semibold">{t("title")}</h1>
        <p className="mt-4 max-w-md font-serif text-xl text-stone">{t("intro")}</p>
      </div>
      <div className="rounded-lg border border-line bg-paper p-5 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="font-display text-3xl font-semibold lg:hidden">{t("title")}</h1>
        <p className="mt-2 text-stone lg:hidden">{t("intro")}</p>
        {error ? (
          <p role="alert" className="mt-4 rounded bg-bordeaux-soft px-3 py-2 text-sm text-bordeaux">
            {t("oauthError")}
          </p>
        ) : null}
        <LoginForm next={target} googleEnabled={env.googleAuthEnabled} />
      </div>
    </div>
  );
}
