# Rapport final — Chesspirit v1.0.0

## Résumé

1. chesspirit.com est construit en entier : compétitions, classements, coaching, boutique, annuaire, média, académie, communauté et administration, en français et en anglais.
2. Le tournoi du 3 octobre 2026 a sa page, son inscription en ligne et son billet à QR code ; ses informations non connues restent « À confirmer » et se modifient dans l'administration.
3. Les tournois se gèrent de bout en bout : assistant de création, appariements suisses FIDE (bbpPairings), toutes rondes, élimination directe, équipes, Arena Lichess, saisie hors ligne, TRF, affiches et attestations.
4. La cote Chesspirit (4 cadences), les 9 ligues et le Chesspirit Tour sont calculés automatiquement ; la liste FIDE est importée chaque mois.
5. Le paiement Mobile Money (FedaPay ou KKiaPay), les SMS, les e-mails et WhatsApp sont branchés derrière des adaptateurs, en mode factice tant que les comptes ne sont pas fournis.
6. La phase 3 ajoute l'adhésion premium, les niveaux et badges, le parrainage, les Awards, les pronostics gratuits, « Le public contre le maître », la recherche par position et l'application mobile Expo (non publiée).
7. La sécurité repose sur des règles d'accès en base testées (200 assertions SQL) ; deux revues de sécurité ont été menées et tous leurs constats corrigés.
8. Les tests sont verts : 104 tests unitaires, 200 assertions SQL, 29 parcours de bout en bout, un test de fumée pour la production.
9. Rien n'a été mis en ligne, payé ni envoyé : la mise en ligne suit `docs/MISE_EN_LIGNE.md` et le script `scripts/setup-production.sh`.
10. Ce qui reste à faire est listé plus bas (« À reprendre ») : notamment trois formats de tournoi, la galerie photo, la lecture réelle des feuilles de notation et l'envoi des notifications push.

## Fonctionnalités par section du cahier des charges

Statuts : **Livré** · **Livré avec service factice** (fonctionne, le prestataire réel reste à brancher) · **Partiel** · **Non fait**.

| Section             | Fonctionnalité                                                                                                                        | Statut                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 8.1 Comptes         | Connexion par SMS, e-mail, Google                                                                                                     | Livré avec service factice (SMS et e-mail envoyés par Supabase une fois configuré ; Google activable) |
| 8.1                 | Profil minimal, compte famille, consentements séparés                                                                                 | Livré                                                                                                 |
| 8.1                 | Profils pré-créés réclamables par téléphone, fusion des doublons                                                                      | Livré                                                                                                 |
| 8.1                 | Compte express créé par l'arbitre                                                                                                     | Partiel (import CSV de participants et réclamation par téléphone ; pas d'écran dédié)                 |
| 8.1                 | Consulter, corriger, exporter, supprimer ses données                                                                                  | Livré                                                                                                 |
| 8.2 Espace joueur   | Cotes, titres, niveau, badges, carte de membre QR                                                                                     | Livré                                                                                                 |
| 8.2                 | Mes tournois, attestations PDF                                                                                                        | Livré                                                                                                 |
| 8.2                 | Mes parties : filtres, lecteur, analyse Stockfish, annotations, PGN                                                                   | Livré                                                                                                 |
| 8.2                 | Statistiques personnelles                                                                                                             | Livré                                                                                                 |
| 8.2                 | Signalement d'erreur                                                                                                                  | Partiel (formulaire de contact)                                                                       |
| 8.3 Tournois        | Assistant de création, duplication, conditions, homologation                                                                          | Livré                                                                                                 |
| 8.3                 | Formulaire personnalisé, paiement, promo, validation, liste d'attente, liste publique                                                 | Livré                                                                                                 |
| 8.3                 | Import CSV des participants, inscription sur place                                                                                    | Livré                                                                                                 |
| 8.3                 | Inscriptions groupées                                                                                                                 | Partiel (import CSV ; pas de panier multi-joueurs hors famille)                                       |
| 8.3                 | Affiches (A3, A4, réseaux) et visuels de résultats                                                                                    | Livré                                                                                                 |
| 8.3                 | Suisse FIDE (bbpPairings), suisse accéléré, toutes rondes, élimination directe, équipes, Arena                                        | Livré                                                                                                 |
| 8.3                 | Scheveningen, poules puis phase finale, simultanée                                                                                    | Non fait (sélectionnables sans moteur dédié)                                                          |
| 8.3                 | Jour J : pointage QR, byes, appariements modifiables, impressions, direct, projection, hors ligne                                     | Livré                                                                                                 |
| 8.3                 | Départages FIDE                                                                                                                       | Livré                                                                                                 |
| 8.3                 | Parties : PGN, saisie, validation ; feuilles photographiées                                                                           | Livré ; lecture des photos : Livré avec service factice                                               |
| 8.3                 | Clôture : classement, cotes, ligues, Tour, rapport PDF, TRF, attestations, brouillon d'article                                        | Livré                                                                                                 |
| 8.3                 | Galerie photo                                                                                                                         | Non fait                                                                                              |
| 8.3                 | Archives : recherche par joueur, ouverture, résultat, période, tournoi, position                                                      | Livré                                                                                                 |
| 8.3                 | Export TRF et CSV ; import Swiss Manager                                                                                              | Partiel (TRF et CSV ; pas d'import de fichiers Swiss Manager)                                         |
| 8.4 Ligues          | 9 championnats, montées et descentes, barrage, reports, forfaits, licence, Triple Couronne                                            | Livré                                                                                                 |
| 8.5 Tour            | Étapes, Majeures, barème, meilleurs résultats, catégories, Masters                                                                    | Livré                                                                                                 |
| 8.6 En ligne        | Liaison Lichess (PKCE), création d'Arena, import, cote en ligne                                                                       | Livré (mode factice en local)                                                                         |
| 8.6                 | Fair-play en visio                                                                                                                    | Partiel (règles affichées, pas d'outil de surveillance)                                               |
| 8.6                 | Équipes                                                                                                                               | Livré                                                                                                 |
| 8.7 Cote            | Méthode Elo, K, amorçage, liste mensuelle, historique, page méthode, calcul Python rejouable                                          | Livré                                                                                                 |
| 8.7                 | Import mensuel FIDE                                                                                                                   | Livré (validé sur un fichier d'exemple ; téléchargement réel non testé, réseau fermé)                 |
| 8.8 Annuaire        | Joueurs, entraîneurs, arbitres, structures, carte, filtres, revendication, emplois, pays                                              | Livré                                                                                                 |
| 8.9 Coaching        | Offres, réservation, paiement, commission désactivable, test de niveau, espaces élève et coach, devis                                 | Livré                                                                                                 |
| 8.10 Boutique       | Catalogue, variantes, stock, avis, souhaits, panier, promo, fidélité, cartes cadeaux, précommandes, livraison, suivi, devis, location | Livré                                                                                                 |
| 8.10                | Remboursement par l'API du prestataire                                                                                                | Partiel (enregistrement manuel)                                                                       |
| 8.11 Média          | Émissions, épisodes, articles, positions jouables                                                                                     | Livré (pas d'épisode réel : un épisode de démonstration)                                              |
| 8.11 Académie       | Leçons, puzzle du jour, défis, ressources, lexique en fon, cours premium                                                              | Livré (fon rempli par la communauté après validation)                                                 |
| 8.11 Communauté     | Adhésion, niveaux et badges, ambassadeurs, parrainage, pronostics, public contre le maître, Awards                                    | Livré (tarif premium « À confirmer »)                                                                 |
| 8.12 Administration | Tous les modules, statistiques, alertes, rapport mensuel                                                                              | Livré                                                                                                 |
| 8.12                | Exports Excel et PDF des statistiques                                                                                                 | Partiel (CSV)                                                                                         |
| 8.13 Pages          | Pages publiques, contact, FAQ, pages légales (brouillons à faire valider)                                                             | Livré                                                                                                 |
| Phase 3             | Assistant WhatsApp                                                                                                                    | Livré avec service factice                                                                            |
| Phase 3             | Application mobile Expo                                                                                                               | Livré (non publiée ; notifications push : jetons enregistrés, envoi non branché)                      |
| Phase 3             | Préparation de la sous-région                                                                                                         | Livré (docs/SOUS_REGION.md)                                                                           |
| Suivi               | Statistiques d'audience (Plausible)                                                                                                   | Livré (activable)                                                                                     |
| Suivi               | Suivi des erreurs (Sentry)                                                                                                            | Non fait                                                                                              |

## Lancer le projet en local

Prérequis : Node 22, pnpm 10, PostgreSQL 15 ou plus, Python 3.12 et uv. Docker est facultatif.

```bash
pnpm install
pnpm dev        # base locale (Postgres, PostgREST, GoTrue) puis le site sur http://localhost:3000
pnpm seed       # tournoi du 3 octobre + données de démonstration (fictives, marquées « Démonstration »)
```

Dans un second terminal, le service échecs :

```bash
cd services/chess-engine && uv run uvicorn app.main:app --port 8000
```

Les codes de connexion SMS et e-mail s'affichent dans `.local/logs/otp.log`. Les comptes de démonstration sont listés dans le `README.md`. Application mobile : voir `apps/mobile/README.md`.

## Captures d'écran

Dans `docs/captures/`, chaque page en téléphone (390 px) et en ordinateur (1440 px) : accueil, calendrier, tournoi du 3 octobre, résultats, partie, connexion, espace joueur, inscription, coaching, boutique, ligues, Tour, annuaire et carte, administration (accueil, inscrits, pointage, réglages, boutique, statistiques, ligues), média, académie, puzzle du jour, lexique, communauté, adhésion, Awards, « le public contre le maître », cours premium, badges, ambassadeurs, archives et explorateur de positions. Aucune page ne défile horizontalement.

## Tests

| Suite                         | Contenu                                                                                                                                                                                                                               | Résultat                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unitaires (Vitest)            | logique partagée (appariements, départages, cotes, Tour, équipes, niveaux, schémas), site, application mobile                                                                                                                         | 91 réussis (47 + 42 + 2) |
| Service échecs (pytest)       | appariements bbpPairings, TRF, cotes, import FIDE                                                                                                                                                                                     | 13 réussis               |
| Règles d'accès (SQL)          | 12 fichiers, dans des transactions annulées                                                                                                                                                                                           | 200 assertions réussies  |
| Parcours (Playwright, 390 px) | inscription et paiement, tournoi complet, coaching, boutique, administration, ligues, en ligne et équipes, annuaire, contenus, exploitation, communauté, archives, feuilles de notation, WhatsApp, API mobile, import de participants | 29 réussis               |
| Fumée (production)            | santé, en-têtes de sécurité, pages clés, espaces protégés, référencement                                                                                                                                                              | 6 réussis en local       |
| Qualité                       | lint (ESLint, ruff), typage strict (TypeScript)                                                                                                                                                                                       | sans erreur              |

Couverture : aucun outil de mesure de couverture n'est installé ; la couverture est fonctionnelle (chaque règle métier a un test unitaire ou SQL, chaque parcours principal un test de bout en bout).

## Décisions importantes

Toutes les décisions prises en autonomie sont consignées, avec les options écartées et leurs raisons, dans [`docs/DECISIONS.md`](docs/DECISIONS.md). La sécurité est détaillée dans [`docs/SECURITE.md`](docs/SECURITE.md), l'extension à la sous-région dans [`docs/SOUS_REGION.md`](docs/SOUS_REGION.md).

## Limites connues et « À reprendre »

- Formats Scheveningen, poules puis phase finale et simultanée : sans moteur d'appariement dédié.
- Galerie photo des tournois : non faite.
- Lecture des feuilles de notation : mode simulé seulement (aucun service de reconnaissance choisi).
- Notifications push de l'application : envoi par Expo Push à brancher côté serveur ; application en français seulement ; icônes définitives à fournir.
- Remboursements par l'API des prestataires : enregistrement manuel.
- Import FIDE : téléchargement réel à vérifier à la mise en ligne.
- Image Docker du service échecs : pas construite pendant le développement (registre inaccessible) ; ses dépendances ont été vérifiées dans un environnement propre. Elle sera construite au premier déploiement.
- Sentry non branché ; exports Excel et PDF des statistiques non faits (CSV).
- Fair-play en visio, écran de « compte express », commentaires et signalement d'erreur par les joueurs : non faits.
- Pages légales : brouillons à faire valider par un juriste ; formalités APDP à accomplir.
- Informations réelles du tournoi du 3 octobre, tarif premium, licences de ligue : « À confirmer », à saisir dans l'administration.

La liste tenue à jour est dans [`PROGRESS.md`](PROGRESS.md).

## Prochaine étape

Suivre [`docs/MISE_EN_LIGNE.md`](docs/MISE_EN_LIGNE.md) : ouvrir les comptes des prestataires, remplir `.env.production`, lancer `bash scripts/setup-production.sh`, puis la recette et le test de fumée.
