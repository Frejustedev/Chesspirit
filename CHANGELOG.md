# Journal des modifications

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
