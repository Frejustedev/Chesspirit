# Avancement

- **Phase en cours** : mise en ligne assistée (le propriétaire a demandé de l'aide pour tout publier)
- **Dernière tâche terminée** : CI verte sur la PR #1 (correctifs du plan du site, des tests SQL et des parcours e2e)
- **Prochaine tâche** : voir « Mise en ligne assistée — état » ci-dessous

## Mise en ligne assistée — état (28 septembre 2026)

Décisions du propriétaire et contraintes constatées :

- **Supabase** : nouvelle organisation gratuite « Chesspirit » créée par le propriétaire avec chesspirit@gmail.com (il a refusé un projet payant dans l'organisation Dizonli). Le projet Supabase existant « dizonliapp@gmail.com's Project » (organisation Dizonli) est une autre application en production : **ne jamais y toucher**.
- **Accès de Claude** : le connecteur Supabase n'a accès qu'à une organisation (choisie à l'autorisation). Le propriétaire le bascule sur l'organisation Chesspirit (ou ajoute un second connecteur personnalisé `https://mcp.supabase.com/mcp`). Depuis la session, `api.supabase.com` et `api.vercel.com` sont bloqués par la politique réseau : tout passe par les connecteurs.
- **Vercel** : équipe « FREJUSTE's projects » (`team_Gh0eLMRnheeegLeaTkmENg80`). Le connecteur ne peut pas créer de projet (403) : le propriétaire importe le dépôt `Frejustedev/Chesspirit` dans Vercel (dossier racine `apps/web`) et colle le bloc de variables fourni ; Claude suit ensuite les déploiements avec le connecteur.
- **Domaine** : chesspirit.com est chez o2switch (DNS externe). Enregistrements à créer quand le projet Vercel existe : `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com` (reprendre les valeurs affichées par Vercel).
- **E-mails de connexion** : boîte o2switch `no-reply@chesspirit.com`, déclarée comme SMTP dans Supabase Auth.

Étapes restantes, dans l'ordre :

1. Appliquer les correctifs de l'audit de mise en production (compatibilité Supabase hébergé, configuration minimale sans paiement ni moteur, authentification hébergée, Vercel, données de départ), CI verte, fusionner la PR #1 dans `main`.
2. Créer le projet Supabase « chesspirit » (région eu-west-3) dans l'organisation Chesspirit, appliquer les migrations une par une, charger les données de référence sans démonstration, lire les conseillers de sécurité.
3. Fournir au propriétaire le bloc de variables Vercel (URL et clé publique Supabase, clé de service copiée par lui, `CRON_SECRET` généré, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_BANNER=false`), puis suivre le déploiement.
4. Domaine chesspirit.com (DNS o2switch), réglages Auth de Supabase (URL du site, redirections, SMTP, modèles d'e-mail avec le code), compte super-administrateur, recette et test de fumée en production.

## Phase 0 — lancement (v0.1.0) ✔

1. Monorepo, CI, design tokens, logotype, en-tête, pied de page, i18n ✔
2. Pile Supabase locale, migrations, politiques et tests RLS ✔
3. Comptes : SMS, e-mail, Google (activable), profil minimal, compte famille ✔
4. Accueil vivant et page du tournoi du 3 octobre ✔
5. Inscription, paiements (factice, FedaPay, KKiaPay, sur place), billet QR, liste publique ✔
6. Administration minimale : inscrits, CSV, pointage QR, 2FA ✔
7. Résultats : import CSV du classement, import PGN, lecteur de parties ✔
8. Script du premier super-administrateur ✔

## Phase 1 — le socle (v0.2.0)

1. Espace joueur : profil, famille, tournois, parties (analyse Stockfish), statistiques, export des données ✔
2. Module tournois : assistant de création, staff, système suisse (bbpPairings + repli), toutes rondes, élimination directe, départages FIDE, direct, projection, impressions, TRF ✔
3. Cote Chesspirit (recalcul idempotent Python + TypeScript) ✔
4. Affiches et documents PDF (attestations, rapport, fiches) ✔
5. Coaching : offres, coachs, réservation payée, test de niveau, devis, candidatures, espaces élève et coach ✔
6. Boutique : catalogue, variantes et stock, avis, liste de souhaits, panier, codes promo, cartes cadeaux, points de fidélité, précommandes, livraison / retrait / sous-région, suivi, administration ✔
7. Administration v1 : utilisateurs (recherche, fiche, rôles, suspension, doublons et fusion, effacement), paiements (filtres, export, remboursements enregistrés), messages, demandes RGPD, devis, réglages, journal d'audit ✔
8. Revue de sécurité de fin de phase 1 et correctifs (docs/SECURITE.md) ✔ — tag v0.2.0
9. Pages légales (brouillons à faire valider) ✔

## Phase 2 — compétitions et contenus (v0.3.0)

1. Ligues et Chesspirit Tour ✔
2. En ligne (Lichess) et équipes, suisse accéléré ✔ (Scheveningen, poules, simultanée : non faits)
3. Annuaire complet, fiches revendicables, carte, emplois ✔
4. Média et académie ✔ (cours premium : phase 3)
5. Statistiques, WhatsApp, mode hors ligne, import FIDE, tâches planifiées ✔ — tag v0.3.0

## Phase 3 — communauté et au-delà (v1.0.0)

1. Communauté : adhésion gratuite ou premium (carte de membre à QR code vérifiable, paiement confirmé par webhook), cours et ressources premium protégés en base, niveaux du Pion au Roi, badges et passeport du Tour, parrainage, ambassadeurs, Chesspirit Awards, pronostics gratuits, « le public contre le maître » ✔
2. Archives : recherche de parties, explorateur de positions (index `game_positions`, tâche planifiée et indexation après import) ✔
3. Feuilles de notation photographiées : parcours complet derrière l'indicateur `scoresheet_ocr`, lecture simulée (aucun service de reconnaissance branché) ✔
4. Assistant WhatsApp : webhook vérifié (jeton + signature X-Hub-Signature-256), réponses sur informations publiques, déduplication, limite par numéro, « stop », indicateur `whatsapp_assistant` ✔
5. Application mobile Expo (`apps/mobile`) : connexion par code, tournois et inscription (API du site), cotes, parties, notifications, profil ; `eas.json` prêt, rien de publié ; compilation Android vérifiée (`expo export`) ✔
6. Préparation de la sous-région : table `countries` (Bénin ouvert, 8 pays préparés), pays relié à chaque fiche, formulaire de profil adapté, ouverture en super-administration ; plan dans docs/SOUS_REGION.md ✔
7. Import CSV des participants d'un tournoi ✔
8. Revue de sécurité finale et correctifs (docs/SECURITE.md) ✔
9. Mise en ligne : docs/MISE_EN_LIGNE.md, scripts/setup-production.sh, test de fumée, santé, plan du site ✔ — tag v1.0.0

## À reprendre

- Formats Scheveningen, poules puis phase finale et simultanée : sélectionnables mais sans moteur d'appariement dédié.
- Galerie photo des tournois : non faite (stockage de fichiers à brancher).
- Lecture des feuilles de notation : aucun service de reconnaissance réel branché (mode simulé seulement ; interface prête dans `lib/ocr.ts`).
- Notifications push de l'application mobile : jetons enregistrés, envoi par Expo Push à brancher côté serveur.
- Application mobile : interface en français seulement ; icônes et écran de lancement définitifs à fournir.
- Image Docker du service échecs : non construite ici (registre Docker inaccessible) ; dépendances de l'image vérifiées dans un environnement Python propre. Construire l'image au premier déploiement (`flyctl deploy` la construit).
- Suivi des erreurs (Sentry) : non branché.
- Fair-play en visio (caméra, partage d'écran) : règles affichées, pas d'outil intégré.
- Création d'un « compte express » par l'arbitre : pas d'écran dédié (l'import CSV crée des profils réclamables par téléphone).
- Exports Excel et PDF des statistiques : CSV seulement.
- Commentaires et signalement d'erreur par les joueurs : non faits (formulaire de contact).
- Import FIDE réel : non testé contre le site FIDE (réseau fermé ici) ; validé sur un fichier d'exemple au même format.

- Remboursements par API des prestataires (FedaPay, KKiaPay) : enregistrement manuel seulement.
