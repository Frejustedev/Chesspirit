import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ApplicationForm } from "./application-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("becomeCoach");
  return { title: t("title") };
}

export default async function BecomeCoach({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("becomeCoach");
  const session = await getSession();
  let pending = false;
  if (session?.profile) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("coach_applications")
      .select("status")
      .eq("profile_id", session.profile.id)
      .eq("status", "pending")
      .maybeSingle();
    pending = !!data;
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 font-serif text-xl text-stone">{t("intro")}</p>
      <div className="mt-8">
        {!session?.profile ? (
          <Link
            href="/connexion?next=/coaching/devenir-coach"
            className="inline-flex min-h-12 items-center rounded-full bg-bordeaux px-6 font-semibold text-cream"
          >
            {t("signIn")}
          </Link>
        ) : pending ? (
          <p role="status" className="rounded-lg bg-gold-soft/60 p-5">
            {t("pending")}
          </p>
        ) : (
          <ApplicationForm city={session.profile.city ?? ""} />
        )}
      </div>
    </div>
  );
}
