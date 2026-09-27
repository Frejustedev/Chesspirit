import "server-only";
import { redirect } from "@/i18n/navigation";
import { getSession, isAdminRole, requireSession } from "@/lib/auth";

/**
 * Accès à l'espace d'administration : administrateurs (double authentification obligatoire)
 * et staff de tournoi (organisateurs, arbitres, opérateurs) pour leurs propres tournois.
 */
export async function requireStaff(locale: string, path: string) {
  const session = await requireSession(locale, path, { onboarded: false });
  const admin = isAdminRole(session.roles);
  const staff = admin || session.roles.some((r) => ["arbiter", "organizer"].includes(r));
  if (!staff) redirect({ href: "/compte", locale });
  if (admin && session.aal !== "aal2") redirect({ href: `/admin/securite?next=${encodeURIComponent(path)}`, locale });
  return { session, admin };
}

export { getSession };
