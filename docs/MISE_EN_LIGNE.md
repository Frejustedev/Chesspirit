# Mise en ligne de chesspirit.com

Ce guide s'adresse à la personne qui met le site en ligne, sans connaissance technique particulière. Les commandes sont à copier telles quelles dans un terminal, depuis le dossier du projet.

> Rien n'a été mis en ligne ni payé pendant le développement : aucun compte n'a été créé chez un prestataire. Tous les services externes fonctionnent en mode factice tant que leurs identifiants ne sont pas fournis.

---

## 1. Résumé

**Ce qui est prêt** : le site complet (compétitions, classements, coaching, boutique, annuaire, média, académie, communauté, administration), en français et en anglais ; la base de données avec ses règles d'accès ; le service échecs (appariements, cotes, import FIDE) ; l'application mobile (non publiée) ; les tâches planifiées ; les fichiers de déploiement et le script `scripts/setup-production.sh`.

**Ce qu'il reste à brancher** : les comptes des prestataires (hébergement, base, paiement Mobile Money, SMS, e-mails, WhatsApp), le domaine chesspirit.com, les vraies informations du tournoi du 3 octobre 2026 (marquées « À confirmer » sur le site), la validation juridique des pages légales et les formalités auprès de l'APDP.

**Durée estimée** : une journée de travail une fois tous les comptes ouverts et validés. La validation d'un compte marchand de paiement ou d'un compte WhatsApp Business peut prendre plusieurs jours : à lancer en premier.

**Tournoi du 3 octobre 2026** : si le site doit servir aux inscriptions de ce tournoi, prévoir la mise en ligne au plus tôt ; à défaut, les inscriptions peuvent être ouvertes avec paiement sur place (aucun compte de paiement requis), puis le paiement en ligne activé ensuite.

---

## 2. Ce que le propriétaire doit fournir

| Élément                                                            | Pourquoi                                                               | Où le créer                                            | Variable(s) concernée(s)                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Compte **Vercel**                                                  | Héberge le site                                                        | vercel.com                                             | (projet Vercel)                                                                                                  |
| Compte **Supabase** et projet                                      | Base de données, comptes utilisateurs, connexion                       | supabase.com                                           | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF` |
| Accès **DNS** du domaine chesspirit.com                            | Faire pointer le domaine vers le site et authentifier les e-mails      | chez le registraire du domaine                         | —                                                                                                                |
| Compte **FedaPay** (ou **KKiaPay**) validé                         | Paiement Mobile Money et carte                                         | fedapay.com ou kkiapay.me                              | `PAYMENT_PROVIDER`, `FEDAPAY_*` ou `KKIAPAY_*`                                                                   |
| Compte **Twilio** (ou autre fournisseur SMS accepté par Supabase)  | Codes de connexion par SMS, rappels                                    | twilio.com                                             | dans Supabase (connexion par téléphone) ; `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`               |
| Compte **Resend** et domaine d'envoi vérifié                       | E-mails (confirmations, reçus, rappels)                                | resend.com                                             | `RESEND_API_KEY`, `EMAIL_FROM`                                                                                   |
| **WhatsApp Business** (Meta)                                       | Notifications et assistant WhatsApp (facultatif)                       | business.facebook.com / developers.facebook.com        | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`                     |
| Hébergeur du **service échecs** (Fly.io, ou Render)                | Appariements suisses (bbpPairings), calcul des cotes, import FIDE      | fly.io ou render.com                                   | `CHESS_ENGINE_URL`, `CHESS_ENGINE_KEY`                                                                           |
| Identifiants **Google OAuth** (facultatif)                         | Connexion avec Google                                                  | console.cloud.google.com                               | dans Supabase (le bouton apparaît quand le fournisseur est activé)                                               |
| **Lichess** (facultatif)                                           | Tournois en ligne ; jeton du compte Chesspirit pour créer des tournois | lichess.org/account/oauth/token                        | `LICHESS_API_TOKEN` (la liaison des comptes joueurs ne demande aucun secret)                                     |
| **Statistiques** (facultatif)                                      | Mesure d'audience sans cookie                                          | plausible.io (ou instance hébergée)                    | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_HOST`                                                     |
| **Sentry** (facultatif)                                            | Suivi des erreurs                                                      | sentry.io                                              | non branché dans le code (voir « À reprendre »)                                                                  |
| Comptes **Expo**, **Google Play**, **Apple Developer** (plus tard) | Publication de l'application mobile                                    | expo.dev, play.google.com/console, developer.apple.com | `apps/mobile/eas.json`                                                                                           |
| Adresse e-mail et téléphone du **super-administrateur**            | Premier compte d'administration                                        | —                                                      | `ADMIN_EMAIL`, `ADMIN_PHONE`                                                                                     |
| Vraies informations du **tournoi du 3 octobre**                    | Lieu, horaires, tarifs, cadence, prix, règlement                       | à saisir dans l'administration                         | —                                                                                                                |

Toutes ces valeurs se rangent dans un fichier `.env.production` à la racine du projet (jamais envoyé sur GitHub : il est exclu automatiquement).

```bash
cp apps/web/.env.example .env.production
# puis ouvrir .env.production avec un éditeur de texte et le remplir
```

Deux valeurs sont à inventer soi-même (longues et aléatoires) :

```bash
openssl rand -hex 24   # pour CRON_SECRET
openssl rand -hex 24   # pour CHESS_ENGINE_KEY (et WHATSAPP_VERIFY_TOKEN si WhatsApp est utilisé)
```

---

## 3. Pas-à-pas

### 3.1 Supabase (base de données et connexion)

1. Créer un projet sur supabase.com. Région : **eu-west-3 (Paris)**, la plus proche du Bénin parmi les régions proposées, et la même que les fonctions du site (`cdg1`, voir 3.3). Noter le mot de passe de la base.
2. Dans _Project Settings → API_ : copier l'URL du projet, la clé `anon` (publique) et la clé `service_role` (secrète) dans `.env.production`. Dans _Project Settings → General_ : copier la référence du projet (`SUPABASE_PROJECT_REF`).
3. **Migrations** : installer la CLI Supabase (supabase.com/docs/guides/cli), puis :
   ```bash
   supabase login
   supabase link --project-ref VOTRE_REFERENCE
   supabase db push
   ```
   (ou lancer le workflow GitHub « Migrations Supabase », voir 4.) La première migration (`20260927000000_api_default_privileges.sql`) rend explicites les droits de l'API : les projets récents ne les accordent plus automatiquement, et sans elle aucune page ne pourrait lire la base. Si les migrations ont été appliquées autrement (outil MCP, éditeur SQL), l'historique doit porter les numéros des fichiers : `supabase migration list` doit afficher les mêmes versions en local et à distance (sinon `supabase migration repair`).
   **Numérotation** : toute nouvelle migration doit porter un numéro supérieur à la dernière existante (par exemple `20261009000200_…`), même si la date du jour est antérieure.
4. **Ne jamais lancer `supabase config push`** : `supabase/config.toml` ne sert qu'au développement local (codes de test, adresses locales).
5. **Réglages de connexion** (_Authentication_), indispensables : le site n'accepte que des **codes à 6 chiffres**, pas des liens.
   - _Sign In / Providers → Email_ : activé, « Confirm email » activé, **Email OTP Length = 6**, Email OTP Expiration = 3600.
   - _Emails → SMTP Settings_ : activer le SMTP personnalisé (sans lui, Supabase n'envoie qu'aux membres de l'équipe du projet, quelques messages par heure). Exemple avec la boîte o2switch `no-reply@chesspirit.com` : hôte `mail.chesspirit.com` (ou celui indiqué par o2switch), port 465, identifiant = l'adresse, mot de passe de la boîte ; expéditeur `no-reply@chesspirit.com`, nom « Chesspirit ». Avec Resend : hôte `smtp.resend.com`, port 465, identifiant `resend`, mot de passe = clé d'API.
   - _Emails → Templates_ : dans **« Magic Link » et « Confirm signup »**, remplacer le contenu par le code (sans lien) :
     - Sujet : `Votre code de connexion Chesspirit`
     - Corps : `<h2>Votre code Chesspirit</h2><p>Saisissez ce code sur la page de connexion :</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p><p>Ce code expire dans une heure. Si vous n'avez rien demandé, ignorez cet e-mail.</p>`
   - _Rate Limits_ (disponible une fois le SMTP activé, 30 e-mails par heure par défaut, pour tout le projet) : « Rate limit for sending emails » = 150 par heure au moins (sans dépasser le quota horaire du fournisseur SMTP). Les vérifications de code sont aussi limitées par adresse IP : le jour du tournoi, demander aux joueurs de se connecter avant d'arriver plutôt que sur le Wi-Fi de la salle.
   - _URL Configuration_ : Site URL `https://chesspirit.com` ; Redirect URLs `https://chesspirit.com/**`, `https://www.chesspirit.com/**` et `https://*-frejustes-projects.vercel.app/**` (prévisualisations).
   - _Multi-Factor_ : laisser TOTP activé (par défaut) : la double authentification est obligatoire pour l'administration.
   - Laisser désactivés : connexions anonymes, CAPTCHA, crochets d'authentification (« Auth Hooks »).
6. **Connexion par téléphone** (plus tard) : _Authentication → Providers → Phone_ : activer avec Twilio (ou autre fournisseur proposé), SMS OTP Length = 6. Tant que ce fournisseur n'est pas activé, l'onglet « Téléphone » est masqué automatiquement sur la page de connexion ; il apparaît dès l'activation (dans les 5 minutes).
7. **Google** (facultatif) : _Authentication → Providers → Google_ avec les identifiants OAuth (dans Google Cloud : origines `https://chesspirit.com` et `https://www.chesspirit.com`, adresse de retour affichée par Supabase, écran de consentement « En production »). Le bouton Google apparaît automatiquement quand le fournisseur est activé (`NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false` le masque malgré tout).
8. **Stockage** : aucun espace de stockage de fichiers n'est utilisé à ce jour (les photos de feuilles de notation ne sont pas conservées ; affiches et attestations sont générées à la demande).
9. **Tâches planifiées** : elles sont lancées par Vercel (voir 3.7), pas par Supabase.

### 3.2 Service échecs (Python)

Avec Fly.io (fichier `services/chess-engine/fly.toml` prêt) :

```bash
cd services/chess-engine
flyctl auth login
flyctl apps create chesspirit-engine        # une seule fois
flyctl secrets set CHESS_ENGINE_KEY=VOTRE_CLE
flyctl deploy --remote-only
curl https://chesspirit-engine.fly.dev/health  # doit répondre {"status":"ok","bbp":true}
```

La région est `cdg` (Paris) par défaut ; la changer dans `fly.toml` si une région plus proche donne de meilleurs temps de réponse. Alternative : Render, avec le fichier `services/chess-engine/render.yaml` (Blueprint). Reporter l'adresse obtenue dans `CHESS_ENGINE_URL`.

### 3.3 Vercel (site) et domaine

La branche de production est `main` : fusionner d'abord la demande de fusion (PR) du projet, sinon le dossier `apps/web` n'existe pas sur `main`.

1. Sur vercel.com : _Add New → Project_, importer le dépôt GitHub `frejustedev/chesspirit`. Réglages :
   - **Root Directory : `apps/web`** ; « Include files outside the Root Directory » : activé (par défaut) ;
   - Framework : Next.js ; commandes d'installation et de compilation : par défaut ;
   - Node.js : 22.x (fixé par `apps/web/package.json`) ; région des fonctions : Paris `cdg1` (fixée par `apps/web/vercel.json`).
2. **Avant de cliquer sur « Deploy »**, ouvrir _Environment Variables_ et saisir (Production et Preview) :
   - `NEXT_PUBLIC_SITE_URL=https://chesspirit.com`
   - `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (3.1, étape 2)
   - `SUPABASE_SERVICE_ROLE_KEY` (secrète)
   - `CRON_SECRET` (au moins 32 caractères : `openssl rand -hex 24`)
   - `NEXT_PUBLIC_DEMO_BANNER=false`

   Ne pas définir `NODE_ENV` ni `PAYMENT_PROVIDER` tant qu'aucun prestataire de paiement n'est validé. Les variables `NEXT_PUBLIC_*` sont figées à la compilation : après toute modification, relancer un déploiement (_Deployments → Redeploy_).

3. _Settings → Domains_ : ajouter `chesspirit.com` et `www.chesspirit.com`. Vercel affiche les enregistrements DNS à créer chez le registraire (en général un enregistrement A `76.76.21.21` pour `chesspirit.com` et un CNAME `cname.vercel-dns.com` pour `www`) : les recopier exactement.
4. Le certificat HTTPS est créé automatiquement par Vercel une fois le DNS propagé (de quelques minutes à quelques heures).
5. Forfait : le forfait gratuit (Hobby) suffit techniquement (tâches planifiées quotidiennes, une région), mais il est réservé à un usage non commercial ; passer au forfait Pro avant d'encaisser des paiements en ligne.

### 3.4 E-mails (SPF, DKIM, DMARC)

1. Sur resend.com : _Domains → Add domain_ : `chesspirit.com`.
2. Resend affiche les enregistrements DNS à créer (SPF et DKIM) : les ajouter chez le registraire, puis cliquer sur _Verify_.
3. Ajouter un enregistrement DMARC (type TXT, nom `_dmarc`) ; pour commencer : `v=DMARC1; p=none; rua=mailto:dmarc@chesspirit.com`, puis durcir en `p=quarantine` après quelques semaines sans problème.
4. Créer une clé d'API Resend (`RESEND_API_KEY`) ; `EMAIL_FROM="Chesspirit <no-reply@chesspirit.com>"`.

### 3.5 Paiement (FedaPay ou KKiaPay)

1. Ouvrir le compte marchand et fournir les documents demandés (délai de validation variable).
2. **Bac à sable d'abord** : `FEDAPAY_ENV=sandbox` (ou `KKIAPAY_SANDBOX=true`) avec les clés de test.
3. Déclarer l'adresse de notification (webhook) dans le tableau de bord du prestataire :
   - FedaPay : `https://chesspirit.com/api/webhooks/payments/fedapay`
   - KKiaPay : `https://chesspirit.com/api/webhooks/payments/kkiapay`

   et copier le secret de signature (`FEDAPAY_WEBHOOK_SECRET` ou `KKIAPAY_SECRET`). Un paiement n'est confirmé **que** par cette notification signée.

4. Faire un paiement de test complet (inscription à un tournoi, commande boutique) et vérifier qu'il apparaît « réussi » dans _Administration → Paiements_.
5. **Bascule en réel** : remplacer par les clés de production, `FEDAPAY_ENV=live` (ou `KKIAPAY_SANDBOX=false`), redéployer, refaire un petit paiement réel puis le rembourser depuis le tableau de bord du prestataire (le remboursement s'enregistre ensuite dans l'administration).

Le paiement simulé est automatiquement refusé en production.

### 3.6 SMS et WhatsApp

- **SMS** : les codes de connexion passent par Supabase (3.1, étape 4). Les rappels SMS utilisent `TWILIO_*`. Vérifier que l'expéditeur choisi est autorisé vers le Bénin (+229).
- **WhatsApp** (facultatif) :
  1. Créer une application Meta avec le produit WhatsApp, un numéro professionnel, un jeton permanent (`WHATSAPP_TOKEN`) et l'identifiant du numéro (`WHATSAPP_PHONE_NUMBER_ID`) ; le secret de l'application va dans `WHATSAPP_APP_SECRET`.
  2. Faire approuver les modèles de messages `tournament_reminder` et `booking_reminder` (langue française).
  3. Webhook de l'assistant : adresse `https://chesspirit.com/api/webhooks/whatsapp`, jeton de vérification = `WHATSAPP_VERIFY_TOKEN` ; s'abonner au champ `messages`.
  4. Activer dans _Administration → Réglages_ les indicateurs `whatsapp_notifications` puis `whatsapp_assistant`.

### 3.7 Tâches planifiées

Elles sont décrites dans `apps/web/vercel.json` et appelées par Vercel Cron avec le jeton `CRON_SECRET` :

| Tâche             | Fréquence (UTC)     | Rôle                                                               |
| ----------------- | ------------------- | ------------------------------------------------------------------ |
| `expire-orders`   | tous les jours 0 h  | libère le stock des commandes non payées depuis 48 h               |
| `index-positions` | tous les jours 2 h  | indexe les parties restantes (les imports indexent déjà les leurs) |
| `reminders`       | tous les jours 16 h | rappels J-1 des tournois et des cours                              |
| `refresh-minors`  | tous les jours      | passage à la majorité                                              |
| `admin-digest`    | tous les jours      | synthèse des alertes aux administrateurs                           |
| `purge-whatsapp`  | tous les jours      | effacement des messages WhatsApp reçus de plus de 90 jours         |
| `rating-lists`    | le 1er du mois      | publication de la liste mensuelle des cotes                        |
| `fide-import`     | le 3 du mois        | import de la liste FIDE (sautée tant que le service échecs manque) |
| `monthly-report`  | le 1er du mois      | rapport mensuel par e-mail                                         |

Toutes les tâches sont au plus quotidiennes : elles sont donc acceptées par tous les forfaits Vercel (le forfait gratuit refuse tout déploiement contenant une tâche plus fréquente). Pour une fréquence plus élevée, un planificateur externe peut appeler les mêmes adresses :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://chesspirit.com/api/cron/expire-orders
```

Chaque exécution est visible dans la table `job_runs` et dans _Administration → Statistiques_.

### 3.8 Sauvegardes, supervision, statistiques

- **Sauvegardes** : vérifier dans Supabase (_Database → Backups_) les sauvegardes incluses dans le forfait. En complément, une copie hebdomadaire hors de Supabase :
  ```bash
  supabase db dump --linked -f sauvegarde-$(date +%F).sql
  ```
  à conserver dans un espace de stockage privé.
- **Disponibilité** : configurer un service de surveillance (par exemple UptimeRobot ou Better Stack) sur `https://chesspirit.com/api/health` (répond `{"status":"ok"}` si le site et la base fonctionnent) et `CHESS_ENGINE_URL/health`.
- **Erreurs** : consulter les journaux Vercel (_Deployments → Functions_) ; Sentry n'est pas encore branché.
- **Statistiques** : renseigner `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=chesspirit.com` (statistiques sans cookie).

### 3.9 Référencement

- Le plan du site est servi à `https://chesspirit.com/sitemap.xml` et `robots.txt` exclut les espaces privés.
- Créer une propriété dans Google Search Console (search.google.com/search-console), la valider par un enregistrement DNS TXT, puis soumettre `sitemap.xml`.

---

## 4. Fichiers de déploiement prêts

| Fichier                                          | Rôle                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `services/chess-engine/Dockerfile`               | Conteneur du service échecs (avec bbpPairings)                                                                             |
| `services/chess-engine/fly.toml` / `render.yaml` | Configuration Fly.io ou Render                                                                                             |
| `.github/workflows/ci.yml`                       | Vérifications à chaque envoi (lint, types, tests)                                                                          |
| `.github/workflows/deploy-database.yml`          | Migrations Supabase (manuel, inactif sans secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`) |
| `.github/workflows/deploy-engine.yml`            | Déploiement du service échecs (inactif sans secret `FLY_API_TOKEN`)                                                        |
| `apps/web/vercel.json`                           | Tâches planifiées                                                                                                          |
| `scripts/setup-production.sh`                    | Automatise la mise en production                                                                                           |

**Script de mise en production** — vérifie la configuration, applique les migrations, charge les données de référence (sans démonstration), crée le super-administrateur, déploie le service échecs (si `CHESS_ENGINE_KEY` est fournie), renseigne les variables du projet Vercel, puis teste. Le site lui-même se déploie depuis GitHub (fusion sur `main`). Seules les variables Supabase et `CRON_SECRET` sont obligatoires : sans prestataire de paiement, les inscriptions se règlent sur place ; sans service échecs, le site calcule lui-même appariements et cotes. Il est rejouable et demande de taper « oui » avant chaque action irréversible :

```bash
bash scripts/setup-production.sh --dry-run   # affiche ce qui serait fait, sans rien faire
bash scripts/setup-production.sh
```

Il utilise les outils `supabase`, `flyctl` et `vercel` s'ils sont installés, et indique quoi faire à la main sinon.

---

## 5. Recette avant ouverture

À faire sur le site en ligne, avec le paiement en bac à sable :

1. Créer un compte par téléphone, puis par e-mail ; compléter le profil ; ajouter un enfant.
2. S'inscrire à un tournoi payant, payer (test), recevoir le billet et l'e-mail ou le SMS.
3. Tournoi complet de bout en bout : créer un tournoi test, pointer les joueurs, apparier 3 rondes, saisir les résultats (dont une saisie hors ligne), publier le classement, exporter le fichier TRF, générer affiches et attestations, clôturer.
4. Réserver un cours de coaching et le payer ; passer le test de niveau.
5. Commander dans la boutique avec un code promo ; suivre la commande ; l'expédier depuis l'administration.
6. Adhésion gratuite, carte de membre (scanner le QR code) ; si le tarif premium est fixé, adhésion premium.
7. Télécharger ses données, puis demander la suppression de son compte ; la traiter depuis l'administration.
8. Vérifier l'administration en double authentification ; journal d'audit.
9. Pages en anglais (`/en`), sur téléphone et sur ordinateur.

**Test de fumée automatique** (lecture seule : aucun compte, paiement ni message) :

```bash
E2E_BASE_URL=https://chesspirit.com pnpm --filter web exec playwright test --project=smoke
```

---

## 6. Formalités et contenus

1. **APDP** (Autorité de Protection des Données Personnelles du Bénin) : se renseigner auprès de l'APDP sur les formalités applicables au traitement (comptes, mineurs, paiements) et les accomplir avant l'ouverture. Le registre des traitements et les durées de conservation sont décrits dans la politique de confidentialité.
2. **Pages légales** : faire relire et valider par un juriste les brouillons (mentions légales, CGU, CGV, confidentialité, cookies, remboursements, règlement type des tournois), puis compléter les champs « À confirmer » (raison sociale, adresse, RCCM, IFU, directeur de publication).
3. **Super-administrateur** :
   ```bash
   SUPABASE_URL=https://VOTRE_REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=... pnpm create-admin --email vous@chesspirit.com --first Prénom --last Nom
   ```
   (ou : se connecter normalement sur `/connexion`, puis dans l'éditeur SQL de Supabase : `insert into public.user_roles (user_id, role) select id, 'super_admin' from auth.users where email = 'vous@chesspirit.com' on conflict do nothing;`). Se connecter ensuite par code e-mail ; `/admin` demande la double authentification : scanner le QR code avec une application (Google Authenticator, Aegis…) et **conserver le secret affiché** en lieu sûr (aucun code de secours n'est fourni).
4. **Données de démonstration** : ne pas les charger en production (`pnpm seed -- --no-demo`, ce que fait le script). Mettre `NEXT_PUBLIC_DEMO_BANNER=false`.
5. **Tournoi du 3 octobre** : dans _Administration → Tournois_, remplacer chaque « À confirmer » (lieu, horaires, frais, cadence, nombre de rondes, prix, capacité, règlement) puis ouvrir les inscriptions. **Saisir l'horaire avant le 1er octobre à 17 h** (heure de Cotonou) : le rappel J-1 part ce jour-là ; tant que l'horaire n'est pas confirmé, il n'annonce que la date.
   Sans service échecs, les appariements suisses utilisent le calcul de secours du site (signalé à l'arbitre et dans le rapport) : il respecte les règles absolues (pas de rematch, écart de couleurs d'au plus 2, jamais trois fois de suite la même couleur) mais n'est pas homologué FIDE. Relire chaque ronde avant de la publier ; pour 8 joueurs ou moins, choisir le système « toutes rondes ».
6. **Participants déjà inscrits** hors du site : les importer depuis un fichier CSV (_Administration → Tournois → Inscrits → Importer_). Tant que la connexion par SMS n'est pas active, un joueur importé qui se connecte par e-mail obtient un nouveau profil : fusionner les doublons (_Administration → Utilisateurs → Doublons_) avant d'apparier la première ronde.
7. **Tarifs** : tarif premium de l'adhésion (_Administration → Communauté_), licences de ligue (_Administration → Ligues_), catalogue de la boutique.

---

## 7. Jour du lancement

1. La veille : dernière sauvegarde (`supabase db dump`), vérifier que tous les tests de la recette sont passés.
2. Basculer le paiement en production (3.5, étape 5) ; redéployer.
3. Lancer le test de fumée contre `https://chesspirit.com`.
4. Faire une inscription réelle de faible montant, vérifier la notification et le billet.
5. Ouvrir les inscriptions du tournoi ; annoncer le site (réseaux, WhatsApp).
6. Pendant la journée : surveiller _Administration → Accueil_ (alertes), _Paiements_ et les journaux Vercel.

---

## 8. Retour arrière

- **Site** : dans Vercel, _Deployments_, choisir le déploiement précédent qui fonctionnait, menu « … » → _Promote to Production_ (ou _Instant Rollback_). Effet immédiat, sans toucher à la base.
- **Base de données** : une migration ne s'annule pas automatiquement. Écrire une migration inverse (nouveau fichier dans `supabase/migrations`), la tester en local (`pnpm stack` puis `pnpm test:rls`), puis `supabase db push`. En dernier recours, restaurer la sauvegarde (Supabase _Database → Backups_, ou le fichier `supabase db dump`) — les données saisies depuis seraient perdues.
- **Service échecs** : `flyctl releases` puis `flyctl deploy --image` avec l'image précédente (ou redéployer le commit précédent).

---

## 9. Après le lancement

- **Chaque jour** : lire la synthèse des alertes (e-mail) ; traiter commandes, demandes et messages.
- **Chaque semaine** : sauvegarde hors Supabase ; vérifier `job_runs` (tâches en échec).
- **Chaque mois** : vérifier la publication de la liste des cotes (le 1er) et l'import FIDE (le 3) ; relire le rapport mensuel.
- **Mises à jour de sécurité** : chaque mois, mettre à jour les dépendances sur une branche (`pnpm update`, `uv lock --upgrade` dans `services/chess-engine`), laisser la CI vérifier, puis déployer. Appliquer sans attendre les alertes de sécurité GitHub (Dependabot).
- **Accès** : retirer les rôles d'administration des personnes qui quittent l'équipe (_Administration → Utilisateurs_).

---

## 10. Coûts

Postes de dépense, sans montant : les prix changent, se référer aux pages officielles au moment de l'ouverture des comptes.

| Service                                                     | Ce qui est facturé                                                          | Tarifs                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Vercel                                                      | forfait d'hébergement (usage commercial, tâches planifiées, bande passante) | vercel.com/pricing                                                      |
| Supabase                                                    | forfait (taille de la base, sauvegardes, utilisateurs actifs)               | supabase.com/pricing                                                    |
| Fly.io ou Render                                            | machine du service échecs                                                   | fly.io/docs/about/pricing, render.com/pricing                           |
| FedaPay / KKiaPay                                           | commission par transaction                                                  | fedapay.com, kkiapay.me                                                 |
| Twilio                                                      | chaque SMS envoyé (codes de connexion, rappels)                             | twilio.com/en-us/sms/pricing                                            |
| Resend                                                      | volume d'e-mails                                                            | resend.com/pricing                                                      |
| WhatsApp Business                                           | conversations ouvertes par l'entreprise (modèles)                           | developers.facebook.com/docs/whatsapp/pricing                           |
| Domaine chesspirit.com                                      | renouvellement annuel                                                       | chez le registraire                                                     |
| Plausible (facultatif)                                      | abonnement selon l'audience                                                 | plausible.io                                                            |
| Sentry (facultatif)                                         | selon le volume d'erreurs                                                   | sentry.io/pricing                                                       |
| Expo EAS, Google Play, Apple Developer (application mobile) | compilations, frais d'inscription des comptes développeur                   | expo.dev/pricing, play.google.com/console, developer.apple.com/programs |
