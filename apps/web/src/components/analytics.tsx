import { env } from "@/lib/env";

/** Statistiques de fréquentation (Plausible) : désactivées sans configuration. */
export function Analytics() {
  if (!env.plausibleDomain || !env.plausibleHost) return null;
  return (
    <script defer data-domain={env.plausibleDomain} src={`${env.plausibleHost}/js/script.js`} />
  );
}
