import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ContactForm } from "./contact-form";
import { IconChat } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title") };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "contact_whatsapp")
    .maybeSingle();
  const whatsapp =
    typeof data?.value === "string" && /^\+?\d{8,15}$/.test(data.value)
      ? data.value.replace(/^\+/, "")
      : null;
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1fr_1.2fr] lg:px-6">
      <div>
        <h1 className="font-display text-5xl font-semibold">{t("title")}</h1>
        <p className="mt-4 font-serif text-xl text-stone">{t("intro")}</p>
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp}`}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-success px-5 font-semibold text-cream"
            rel="noopener"
          >
            <IconChat className="size-5" /> {t("whatsapp")}
          </a>
        ) : (
          <p className="mt-6 text-sm text-stone">
            {t("whatsapp")} : <span className="tbc">{t("tbc")}</span>
          </p>
        )}
      </div>
      <ContactForm />
    </div>
  );
}
