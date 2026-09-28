# Journal des modifications

## [1.0.2] — 2026-09-28 — Derniers constats de l'audit

### Modifié

- Dates enregistrées au jour de Porto-Novo (`localDate`) et non au jour UTC : fichier TRF, archives, historique des cotes, rapport d'arbitrage.
- Saison de ligues en préparation : dates au mois près, délai de report et règle de Sofia « à confirmer ».
- Règlement des tournois : moteur bbpPairings ou calcul de secours signalé ; message d'échec de connexion neutre ; bouton Google laissé à la détection automatique dans `.env.example`.
- `docs/MISE_EN_LIGNE.md` : bascule DNS chez o2switch sans couper la messagerie (enregistrements `mail`, MX, SPF, AAAA), serveur SMTP o2switch, forfait Vercel, dépôt public.

## [1.0.1] — 2026-09-28 — Préparation de la mise en production

### Sécurité

- Vues publiques en lecture seule pour les rôles d'API : un visiteur anonyme pouvait modifier ou supprimer des profils et déverrouiller le contenu premium par trois vues modifiables (P1, docs/SECURITE.md).
- Droits de l'API explicites dès la première migration : un projet Supabase récent n'aurait servi aucune donnée (P2).
- Effacement d'un compte : suppression du compte de connexion débloquée, erreur remontée (P3) ; journaux de production sans données personnelles (P4).

### Modifié

- Connexion : méthodes proposées selon les réglages réels de Supabase Auth (onglet téléphone masqué sans fournisseur SMS, bouton Google selon le fournisseur).
- Sans prestataire de paiement : boutique, cours payants, licences, adhésion premium et inscription « en ligne » fermés avant toute réservation ; textes (pied de page, FAQ, boutique, adhésion) alignés sur le paiement sur place ; interrupteur `payments_online` effectif.
- Horaire « à confirmer » : compte à rebours en jours et rappel J-1 sans heure provisoire.
- Vercel : tâches planifiées quotidiennes (compatibles avec tous les forfaits), fonctions à Paris (`cdg1`), Node 22 ; polices des affiches embarquées dans la fonction déployée.
- Appariement suisse de secours conforme aux critères absolus de couleur de la FIDE (écart ≤ 2, jamais trois fois la même couleur) ; rapport d'arbitrage : appariement de secours signalé ; import FIDE sauté sans service échecs.
- `scripts/setup-production.sh` : paiement et service échecs facultatifs, liaison Vercel par dépôt ; `create-admin` insensible à la casse de l'e-mail.
- `docs/MISE_EN_LIGNE.md` : réglages Supabase Auth complets (SMTP, modèles d'e-mail avec le code, limites), réglages Vercel exacts.

## [1.0.0] — 2026-09-28 — Phase 3 : communauté, application mobile et mise en ligne

### Ajouté

- Communauté : adhésion gratuite ou premium (tarif premium « à confirmer » tant qu'il n'est pas fixé, paiement confirmé par webhook), carte de membre à QR code vérifiable, cours et ressources premium protégés en base, niveaux du Pion au Roi, badges et passeport du Tour, parrainage (lien et code), ambassadeurs, Chesspirit Awards, pronostics gratuits sans argent, « Le public contre le maître », administration de la communauté.
- Archives : recherche de parties (joueur, ouverture, année, résultat) et explorateur de positions (index des positions, coups suivants et résultats).
- Feuilles de notation photographiées derrière l'indicateur `scoresheet_ocr` : lecture simulée, relecture validée coup par coup, enregistrement de la partie.
- Assistant WhatsApp (webhook signé, réponses sur informations publiques, « stop »).
- Import CSV des participants d'un tournoi (rapprochement des profils existants).
- Application mobile Expo : connexion par code, tournois et inscription, cotes, parties, notifications, profil ; configuration EAS sans publication.
- Préparation de la sous-région : pays reliés à chaque fiche, 8 pays préparés et fermés, ouverture en super-administration.
- Mise en ligne : `docs/MISE_EN_LIGNE.md`, `scripts/setup-production.sh`, test de fumée, `/api/health`, `sitemap.xml`, `robots.txt`.

### Sécurité

- Revue finale (docs/SECURITE.md, M1 à M4 et F1 à F5) : publication des structures réservée à la modération, parties public/maître réservées à l'administration, nom et âge des mineurs réduits dans toutes les vues publiques, tentatives de puzzle vérifiées par le serveur, CSV des statistiques échappé, liens web contrôlés, reports de ligue conditionnés à l'accord de l'adversaire, mode factice Lichess refusé en production.

## [0.3.0] — 2026-09-28 — Phase 2 : compétitions et contenus

### Ajouté

- Ligues : saisons, 9 championnats (Ligue 1, Ligue 2, Amateur × classique, rapide, blitz), journées rattachées aux tournois, classements (Sonneborn-Berger), montées, descentes et barrage proposés, licence payante, reports (accord de l'adversaire puis de l'arbitre), forfaits et exclusion, titres et Triple Couronne, administration complète.
- Chesspirit Tour : étapes (Majeures 1,5, en ligne 0,5), barème paramétrable, meilleurs résultats, classements par catégorie, zone Masters.
- En ligne : liaison Lichess (OAuth PKCE, identité seule), création d'Arena, import des résultats et des parties, cote en ligne distincte, règles de fair-play.
- Tournois par équipes : compositions, ordre des échiquiers, appariement suisse, couleurs alternées, résultats par échiquier, classement aux points de match ou de partie, contrôle des compositions ; suisse accéléré (méthode Baku) transmis à bbpPairings.
- Annuaire : joueurs, entraîneurs, arbitres, structures proposées et revendiquées (badge vérifié), carte « Où jouer au Bénin », offres d'emploi, modération.
- Média et académie : émissions, épisodes vidéo, podcast et direct, articles (brouillon automatique à la clôture d'un tournoi), leçons avec positions jouables, puzzle du jour et série, défi de la semaine, ressources, lexique français, anglais et fon (propositions validées), administration des contenus.
- Exploitation : statistiques d'administration et export CSV, alertes, préférences de notification (e-mail, SMS, WhatsApp derrière indicateur), tâches planifiées (expiration des commandes, rappels J-1, liste mensuelle des cotes, import FIDE, synthèse et rapport mensuel), arbitrage hors ligne (IndexedDB et service worker).

### Corrigé

- Politiques des structures (récursion), nom de famille des mineurs dans la vue publique, CSP pour la redirection Lichess.

## [0.2.0] — 2026-09-28 — Phase 1 : le socle

### Ajouté

- Espace joueur : mes tournois (rang, score, performance, variation de cote, attestations PDF), mes parties (filtres, lecteur, analyse Stockfish dans le navigateur, annotations, PGN), statistiques, confidentialité.
- Module tournois complet : assistant de création en 5 étapes, équipe du tournoi (organisateurs, arbitres, opérateurs), système suisse FIDE (bbpPairings, repli TypeScript), toutes rondes (Berger), élimination directe avec blitz et Armageddon, forfaits et byes, départages FIDE 2023, publication des rondes, direct avec mode projection, impressions, export TRF, rapport d'arbitrage PDF, affiches (A3, A4, réseaux sociaux), duplication.
- Cote Chesspirit : recalcul complet et idempotent (service Python, repli TypeScript), page publique de la méthode, classements, Elo FIDE.
- Coaching : offres filtrables (langue, modalité, niveau, format), fiches coachs, réservation de créneaux avec paiement et commission paramétrable, test de niveau, devis écoles et entreprises, candidatures de coachs, espaces élève et coach (devoirs, notes de progression), administration.
- Boutique : catalogue, variantes et stock, avis d'acheteurs, liste de souhaits, panier, codes promo, cartes cadeaux, points de fidélité, précommandes, retrait / livraison à Cotonou / expédition sous-région, paiement, suivi public de commande, location et commandes groupées sur devis, administration (commandes, produits, codes).
- Administration v1 : utilisateurs (recherche, fiche, rôles, suspension, doublons et fusion, effacement RGPD), paiements (filtres, export CSV, remboursements enregistrés), messages, demandes RGPD, devis, réglages et fonctionnalités, journal d'audit.
- Début de la phase 2 : ligues (9 championnats, classements, licences, reports) et Chesspirit Tour (étapes, barème, points, classements par catégorie).

### Sécurité

- Revue de fin de phase 1 et correctifs : voir `docs/SECURITE.md`.

## [0.1.0] — 2026-09-27 — Phase 0 : lancement

### Ajouté

- Monorepo pnpm, intégration continue (lint, typage, tests web et Python, RLS, parcours Playwright), workflows de déploiement inactifs sans secrets.
- Design tokens, logotype provisoire (« s » central en or), pièces d'échecs et pictogrammes SVG maison, polices auto-hébergées.
- En-tête (8 menus, recherche, panier, compte, bouton d'action contextuel), pied de page, FR/EN.
- Accueil vivant : prochain événement avec compte à rebours en pendule d'échecs, puzzle du jour jouable, derniers résultats, top 10, chiffres clés.
- Page du tournoi du 3 octobre 2026 (faits connus, le reste « À confirmer »), calendrier, fichier agenda (.ics).
- Comptes : code SMS, e-mail, Google (activable) ; profil minimal ; consentements séparés ; compte famille ; export et demande de suppression des données.
- Inscription avec paiement (factice, FedaPay, KKiaPay, sur place), liste d'attente, billet avec QR code, confirmations SMS/WhatsApp/e-mail (factices sans clé), liste publique des inscrits.
- Administration : double authentification TOTP, inscrits, export CSV, pointage par QR code, import du classement (CSV) et des parties (PGN), réglages du tournoi, journal d'audit.
- Résultats et lecteur de parties, téléchargement PGN.
- Pages légales (projets à faire valider par un juriste), à propos, contact, FAQ, pages « en préparation ».
- Script de création du premier super-administrateur ; seed du tournoi réel et des données de démonstration.
- Service échecs Python (FastAPI) : cotes rejouables, tables de Berger ; Dockerfile avec bbpPairings.
