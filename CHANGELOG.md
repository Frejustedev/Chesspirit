# Journal des modifications

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
