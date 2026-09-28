import { getTranslations } from "next-intl/server";
import { getSession, isAdminRole } from "@/lib/auth";
import { AdminNavLinks } from "./admin-nav-links";

/** Barre de navigation de l'administration (affichée selon les rôles). */
export async function AdminNav() {
  const session = await getSession();
  if (!session) return null;
  const admin = isAdminRole(session.roles) && session.aal === "aal2";
  const staff = session.roles.some((r) => ["arbiter", "organizer"].includes(r));
  const editor = session.roles.includes("editor");
  if (!admin && !staff && !editor) return null;
  const t = await getTranslations("adminNav");
  const has = (...roles: string[]) =>
    session.roles.some((r) => ["admin", "super_admin", ...roles].includes(r));
  const items: [string, string][] = admin || staff ? [["/admin", t("home")]] : [];
  if (admin) {
    items.push(["/admin/utilisateurs", t("users")]);
    if (has("admin_competitions")) items.push(["/admin/ligues", t("leagues")]);
    if (has("admin_competitions", "admin_shop")) items.push(["/admin/paiements", t("payments")]);
    if (has("admin_shop")) items.push(["/admin/boutique", t("shop")]);
    items.push(["/admin/coaching", t("coaching")]);
    items.push(["/admin/annuaire", t("directory")]);
    items.push(["/admin/messages", t("messages")]);
    if (has("moderator")) items.push(["/admin/contenus", t("content")]);
    items.push(["/admin/reglages", t("settings")]);
    items.push(["/admin/journal", t("audit")]);
  }
  if (!admin && editor) items.push(["/admin/contenus", t("content")]);
  return <AdminNavLinks items={items} label={t("label")} />;
}
