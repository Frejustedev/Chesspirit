#!/usr/bin/env bash
# Mise en production de Chesspirit : automatise ce qui peut l'être une fois les identifiants fournis.
#
#   1. Copier le modèle :   cp apps/web/.env.example .env.production   (jamais versionné)
#   2. Le remplir (voir docs/MISE_EN_LIGNE.md, « Ce que le propriétaire doit fournir »)
#   3. Lancer :              bash scripts/setup-production.sh            (ou --dry-run pour tout afficher sans rien faire)
#
# Rejouable sans risque : chaque étape vérifie l'état avant d'agir et demande confirmation avant toute
# action irréversible. Aucun secret n'est affiché ni écrit ailleurs que chez les hébergeurs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.production}"
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h | --help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# Confirmation explicite (réponse « oui ») lue sur le terminal, même si l'entrée standard est redirigée.
confirm() {
  if $DRY_RUN; then echo "  (simulation) $1 — ignoré"; return 1; fi
  local answer
  read -r -p "  $1 Taper « oui » pour continuer : " answer </dev/tty || return 1
  [ "$answer" = "oui" ]
}
run() {
  if $DRY_RUN; then echo "  (simulation) $*"; else "$@"; fi
}
has() { command -v "$1" >/dev/null 2>&1; }

bold "0. Fichier de configuration"
if [ ! -f "$ENV_FILE" ]; then
  fail "$ENV_FILE introuvable. Copier apps/web/.env.example vers .env.production et le remplir."
  exit 1
fi
if git -C "$ROOT" ls-files --error-unmatch "$ENV_FILE" >/dev/null 2>&1; then
  fail "$ENV_FILE est suivi par Git : le retirer du dépôt avant de continuer (il contient des secrets)."
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
ok "Configuration lue (valeurs non affichées)."

bold "1. Outils"
for tool in node pnpm supabase vercel flyctl curl; do
  if has "$tool"; then ok "$tool"; else warn "$tool absent : les étapes qui l'utilisent seront ignorées."; fi
done

bold "2. Variables obligatoires"
REQUIRED=(NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_PROJECT_REF CRON_SECRET)
missing=0
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then fail "$v manquante"; missing=1; else ok "$v"; fi
done
case "${PAYMENT_PROVIDER:-}" in
  "") warn "PAYMENT_PROVIDER vide : pas de paiement en ligne (inscriptions payables sur place ; boutique et cours payants fermés)." ;;
  fedapay) for v in FEDAPAY_SECRET_KEY FEDAPAY_WEBHOOK_SECRET; do [ -n "${!v:-}" ] || { fail "$v manquante"; missing=1; }; done ;;
  kkiapay) for v in KKIAPAY_PUBLIC_KEY KKIAPAY_PRIVATE_KEY KKIAPAY_SECRET; do [ -n "${!v:-}" ] || { fail "$v manquante"; missing=1; }; done ;;
  fake) warn "PAYMENT_PROVIDER=fake : aucun paiement réel possible (refusé en production sauf ALLOW_FAKE_PAYMENTS=true)." ;;
  *) fail "PAYMENT_PROVIDER doit valoir fedapay, kkiapay ou fake"; missing=1 ;;
esac
if [ "${#CRON_SECRET}" -lt 32 ] 2>/dev/null; then fail "CRON_SECRET trop court (32 caractères au moins : openssl rand -hex 24)"; missing=1; fi
[ -n "${CHESS_ENGINE_URL:-}" ] && [ -n "${CHESS_ENGINE_KEY:-}" ] ||
  warn "CHESS_ENGINE_URL ou CHESS_ENGINE_KEY vide : appariements et cotes calculés par le site (repli)."
for v in RESEND_API_KEY TWILIO_ACCOUNT_SID WHATSAPP_TOKEN WHATSAPP_APP_SECRET; do
  [ -n "${!v:-}" ] || warn "$v vide : service correspondant en mode factice (rien n'est envoyé)."
done
if [ "$missing" = 1 ]; then
  fail "Compléter $ENV_FILE puis relancer."
  exit 1
fi

bold "3. Base de données Supabase"
if has supabase; then
  run supabase link --project-ref "$SUPABASE_PROJECT_REF"
  echo "  Migrations en attente :"
  run supabase migration list || true
  if confirm "Appliquer les migrations sur la base de production (irréversible sans migration inverse) ?"; then
    run supabase db push
    ok "Migrations appliquées."
  else
    warn "Migrations non appliquées."
  fi
else
  warn "CLI Supabase absente : appliquer les migrations depuis GitHub (workflow « Migrations Supabase »)."
fi
warn "Réglages d'authentification (SMTP, modèles d'e-mail avec le code, URL du site) : à faire dans le tableau de bord Supabase (docs/MISE_EN_LIGNE.md, section 3.1). Ne jamais lancer « supabase config push » : supabase/config.toml ne sert qu'au développement local."

bold "4. Données de référence (sans données de démonstration)"
if confirm "Charger les données de référence (tournoi du 3 octobre, boutique, ligues, contenus), sans démonstration ?"; then
  run env SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    pnpm --dir "$ROOT" seed -- --no-demo
fi

bold "5. Compte super-administrateur"
if [ -n "${ADMIN_EMAIL:-}" ]; then
  if confirm "Créer (ou confirmer) le super-administrateur $ADMIN_EMAIL ?"; then
    run env SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      pnpm --dir "$ROOT" create-admin --email "$ADMIN_EMAIL" ${ADMIN_PHONE:+--phone "$ADMIN_PHONE"}
  fi
else
  warn "ADMIN_EMAIL non renseignée : étape ignorée."
fi

bold "6. Service échecs (Fly.io)"
if [ -z "${CHESS_ENGINE_KEY:-}" ]; then
  warn "CHESS_ENGINE_KEY vide : service échecs non déployé (le site utilise ses calculs de repli)."
elif has flyctl; then
  cd "$ROOT/services/chess-engine"
  if flyctl status >/dev/null 2>&1; then
    ok "Application Fly existante."
  elif confirm "Créer l'application Fly « chesspirit-engine » (peut entraîner une facturation) ?"; then
    run flyctl apps create chesspirit-engine
  fi
  if confirm "Enregistrer la clé du service et déployer le service échecs ?"; then
    printf 'CHESS_ENGINE_KEY=%s\n' "$CHESS_ENGINE_KEY" | run flyctl secrets import --stage
    run flyctl deploy --remote-only
  fi
  cd "$ROOT"
else
  warn "flyctl absent : déployer le service avec services/chess-engine/Dockerfile chez l'hébergeur choisi."
fi

bold "7. Site (Vercel)"
if has vercel; then
  # Liaison par dépôt (monorepo) : le dossier apps/web est associé au projet importé depuis GitHub.
  cd "$ROOT"
  run vercel link --repo --yes
  cd "$ROOT/apps/web"
  VARS=(NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
    PAYMENT_PROVIDER FEDAPAY_ENV FEDAPAY_SECRET_KEY FEDAPAY_WEBHOOK_SECRET KKIAPAY_PUBLIC_KEY KKIAPAY_PRIVATE_KEY
    KKIAPAY_SECRET KKIAPAY_SANDBOX RESEND_API_KEY EMAIL_FROM TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM
    WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_TEMPLATE_LANG WHATSAPP_VERIFY_TOKEN WHATSAPP_APP_SECRET
    CHESS_ENGINE_URL CHESS_ENGINE_KEY CRON_SECRET NEXT_PUBLIC_AUTH_GOOGLE_ENABLED NEXT_PUBLIC_PLAUSIBLE_DOMAIN
    NEXT_PUBLIC_PLAUSIBLE_HOST LICHESS_CLIENT_ID LICHESS_API_TOKEN OCR_PROVIDER NEXT_PUBLIC_DEMO_BANNER)
  existing="$( $DRY_RUN && echo "" || vercel env ls production 2>/dev/null || true)"
  for v in "${VARS[@]}"; do
    [ -n "${!v:-}" ] || continue
    if grep -qw "$v" <<<"$existing"; then
      ok "$v déjà définie (non modifiée ; la changer dans le tableau de bord Vercel)"
    else
      printf '%s' "${!v}" | run vercel env add "$v" production >/dev/null && ok "$v ajoutée"
    fi
  done
  warn "Déploiement : fusionner (ou pousser) sur la branche main ; Vercel construit à partir de GitHub. Après toute modification d'une variable NEXT_PUBLIC_*, relancer un déploiement (Redeploy) : ces valeurs sont figées à la compilation."
  cd "$ROOT"
else
  warn "CLI Vercel absente : importer le dépôt dans Vercel (dossier racine apps/web) et saisir les variables."
fi

bold "8. Vérifications"
if has curl && ! $DRY_RUN; then
  if curl -fsS --max-time 20 "$NEXT_PUBLIC_SITE_URL/api/health" >/dev/null; then ok "Site et base joignables"; else warn "Site injoignable pour l'instant (DNS ou déploiement en cours ?)"; fi
  if [ -n "${CHESS_ENGINE_URL:-}" ]; then
    if curl -fsS --max-time 20 "$CHESS_ENGINE_URL/health" >/dev/null; then ok "Service échecs joignable"; else warn "Service échecs injoignable"; fi
  fi
fi
echo "  Test de fumée complet :"
echo "    E2E_BASE_URL=$NEXT_PUBLIC_SITE_URL pnpm --filter web exec playwright test --project=smoke"
bold "Terminé. Suite : docs/MISE_EN_LIGNE.md (webhooks, DNS, recette, jour du lancement)."
