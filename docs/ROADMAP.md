# Feuille de route — Chesspirit

## 12. Plan de développement

Enchaîne les phases sans interruption. Chaque phase se termine par : tests verts, captures des pages clés dans `docs/captures/`, `PROGRESS.md` à jour, push et tag.

### Phase 0 : lancement (tag v0.1.0)

Objectif : un socle déployable avec la page du tournoi du 3 octobre 2026.

1. Monorepo, intégration continue, design tokens, logotype provisoire, en-tête et pied de page, i18n.
2. Supabase local, premières migrations et politiques d'accès.
3. Comptes : connexion par téléphone, e-mail et Google ; profil minimal ; compte famille simple.
4. Accueil et page du tournoi du 3 octobre (faits connus uniquement, le reste « À confirmer »).
5. Inscription avec compte, paiement (fournisseur factice, FedaPay en bac à sable, et « paiement sur place »), billet avec QR code, liste publique des inscrits.
6. Administration minimale : inscrits, export CSV, pointage par QR code.
7. Page de résultats : import du classement final (CSV ou saisie) et des fichiers PGN.
8. Script de création du premier compte super-administrateur.

Si la date du 3 octobre 2026 est passée quand tu termines cette phase, garde la page comme archive d'événement passé, prête à recevoir les résultats.

### Phase 1 : le socle (tag v0.2.0)

Espace joueur complet (dont Mes parties : lecteur, analyse, téléchargement PGN), module tournois complet (service Python et bbpPairings, toutes rondes, élimination directe, départages, saisie, projection, affiches, PGN, export TRF, attestations), cote Chesspirit, coaching et réservation, boutique, administration v1, pages légales, revue de sécurité.

### Phase 2 : compétitions et contenus (tag v0.3.0)

Ligues (9 championnats), Chesspirit Tour, compétitions en ligne via Lichess, tournois par équipes et autres formats, annuaire complet avec fiches revendicables et carte, média et académie, tableaux de bord statistiques, notifications WhatsApp, mode hors ligne de l'arbitrage, import mensuel FIDE, tâches planifiées.

### Phase 3 : communauté et extension (tag v1.0.0 avec le plan de mise en ligne)

Niveaux et badges, adhésion premium, Awards, pronostics, partie « Le public contre le maître », assistant WhatsApp, recherche par position, lecture de feuilles de notation photographiées (derrière un indicateur, service factice si nécessaire), application mobile Expo (connexion, profil, cotes, tournois et inscription, Mes parties, notifications ; configuration EAS prête, sans publication), préparation de l'extension à la sous-région, revue de sécurité finale.

