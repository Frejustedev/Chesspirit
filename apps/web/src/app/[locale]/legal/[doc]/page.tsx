import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LEGAL_NAV } from "@/lib/nav";
import { MiniMarkdown } from "@/lib/mini-markdown";

const DOCS = Object.fromEntries(LEGAL_NAV.map((i) => [i.href.split("/").pop()!, i.key]));

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const t = await getTranslations("nav.items");
  return DOCS[doc] ? { title: t(DOCS[doc]) } : {};
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  if (!DOCS[doc]) notFound();
  const t = await getTranslations();
  const source = await fs.readFile(path.join(process.cwd(), "content/legal", `${doc}.md`), "utf8");
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <p className="tbc">{t("common.draftLegal")}</p>
      <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
        {t(`nav.items.${DOCS[doc]}`)}
      </h1>
      {locale !== "fr" ? (
        <p className="mt-4 rounded bg-cream p-3 text-sm">{t("legal.frenchReference")}</p>
      ) : null}
      <p className="mt-2 text-sm text-stone">{t("legal.version")}</p>
      <div className="mt-6">
        <MiniMarkdown source={source} />
      </div>
    </article>
  );
}
