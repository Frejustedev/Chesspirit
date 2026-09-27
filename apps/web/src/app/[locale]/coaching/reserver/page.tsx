import { redirect } from "@/i18n/navigation";

export default async function BookIndex({ params }: { params: Promise<{ locale: string }> }) {
  redirect({ href: "/coaching", locale: (await params).locale });
}
