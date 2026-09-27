# Avancement

- **Phase en cours** : 2 — compétitions et contenus
- **Dernière tâche terminée** : phase 1 complète (tag v0.2.0) ; phase 2 : ligues et Tour (pages publiques, espace joueur)
- **Prochaine tâche** : administration des ligues et du Tour, puis en ligne (Lichess) et équipes

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

1. Ligues et Chesspirit Tour — en cours
2. En ligne (Lichess) et équipes, autres formats
3. Annuaire complet, fiches revendicables, carte, emplois
4. Média et académie
5. Statistiques, WhatsApp, mode hors ligne, import FIDE, tâches planifiées

## À reprendre

- Remboursements par API des prestataires (FedaPay, KKiaPay) : enregistrement manuel seulement.
