import "server-only";

/**
 * Accès premium (adhésion). Tant que le module d'adhésion n'est pas livré, aucun contenu
 * premium n'est accessible hors équipe éditoriale ; la fonction sera branchée sur les adhésions.
 */
export async function hasPremium(profileId: string | null): Promise<boolean> {
  void profileId;
  return false;
}
