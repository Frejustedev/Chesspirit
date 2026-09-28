# Avancement

- **Phase en cours** : 3 — communauté, premium et application mobile
- **Dernière tâche terminée** : phase 2 complète (tag v0.3.0)
- **Prochaine tâche** : phase 3 — badges et niveaux, adhésion premium, Awards, pronostics, « le public contre le maître », assistant WhatsApp, recherche par position, OCR des feuilles (factice), application Expo, préparation sous-région, revue de sécurité finale

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

## À reprendre

- Formats Scheveningen, poules puis phase finale et simultanée : sélectionnables mais sans moteur d'appariement dédié.
- Galerie photo des tournois : non faite (stockage de fichiers à brancher).
- Lecture des feuilles de notation : aucun service de reconnaissance réel branché (mode simulé seulement ; interface prête dans `lib/ocr.ts`).
- Notifications push de l'application mobile : jetons enregistrés, envoi par Expo Push à brancher côté serveur.
- Application mobile : interface en français seulement ; icônes et écran de lancement définitifs à fournir.
- Import FIDE réel : non testé contre le site FIDE (réseau fermé ici) ; validé sur un fichier d'exemple au même format.

- Remboursements par API des prestataires (FedaPay, KKiaPay) : enregistrement manuel seulement.
