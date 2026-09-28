# Spécification fonctionnelle et technique — Chesspirit

> Extrait des sections 4 à 11 du brief (docs/BRIEF.md), complété par le dossier de projet (docs/Chesspirit-Dossier-de-projet.pdf). Les compléments et arbitrages sont tracés dans docs/DECISIONS.md.

## 4. Le projet en bref

Chesspirit est la plateforme de référence des échecs au Bénin. Elle réunit dans un seul écosystème, avec un compte unique par personne :

- **Coaching** : cours en présentiel ou en ligne, en français, anglais ou fon, adaptés au niveau.
- **Compétitions** : gestion complète de tournois, ligues individuelles en 3 divisions × 3 cadences, circuit « Chesspirit Tour », compétitions en ligne et par équipes.
- **Classement** : cote Chesspirit (en attendant le classement fédéral) et Elo FIDE importé.
- **Annuaire** : joueurs, entraîneurs, arbitres, clubs et professionnels des échecs au Bénin.
- **Boutique** : échiquiers, pendules, livres, accessoires, merchandising, location de matériel.
- **Média et académie** : vidéos, podcasts, leçons, puzzles, ressources.
- **Administration** : un espace qui voit et gère tout, avec des statistiques complètes.

Contexte d'usage :

- Public béninois d'abord, majoritairement francophone.
- Usage surtout sur téléphone, avec une connexion parfois lente ou instable.
- Paiement surtout par Mobile Money (MTN MoMo, Moov Money, Celtiis Cash).
- Devise : franc CFA (XOF). Fuseau horaire : Africa/Porto-Novo (UTC+1).
- Premier événement : tournoi Chesspirit en cadence rapide, le samedi 3 octobre 2026, à la FSS de Cotonou, avec la FSS et Ayelade Chess comme partenaires.

Stratégie clé : le module de gestion de tournois est gratuit pour tous les organisateurs du pays. Chaque tournoi géré sur Chesspirit enrichit la base nationale des joueurs et des parties.

## 5. Stack technique

| Couche                        | Choix                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Web                           | Next.js (App Router) et TypeScript strict, Tailwind CSS, déployable sur Vercel                                                          |
| Données                       | Supabase : Postgres, Auth (code par SMS, e-mail, Google), Storage, Realtime, Edge Functions                                             |
| Migrations                    | SQL versionné dans `supabase/migrations`, réversible quand c'est possible                                                               |
| Sécurité des données          | Row Level Security activée sur toutes les tables, sans exception                                                                        |
| Service échecs                | Python 3.12 et FastAPI dans un conteneur Docker                                                                                         |
| Appariements                  | bbpPairings (moteur suisse homologué par la FIDE), appelé par le service Python                                                         |
| Règles et PGN côté client     | chess.js                                                                                                                                |
| Échiquier                     | Composant sous licence permissive (par exemple react-chessboard, MIT). Pas de chessground (GPL).                                        |
| Analyse                       | Stockfish en WebAssembly dans un Web Worker, chargé à part. Licence GPL : documente les obligations dans `docs/LICENCES.md`.            |
| Langues                       | next-intl, français par défaut, anglais                                                                                                 |
| Formulaires                   | React Hook Form et Zod, schémas partagés entre client et serveur                                                                        |
| Paiement                      | Interface commune ; FedaPay par défaut, KKiaPay en alternative, « paiement sur place », et un fournisseur factice pour le développement |
| Notifications                 | E-mail par Resend ; SMS par Supabase Auth avec Twilio ; WhatsApp Business Cloud API ; fournisseurs factices en développement            |
| Affiches et visuels           | Rendu HTML/CSS vers PNG (Satori) ; PDF avec react-pdf ou WeasyPrint dans le service Python                                              |
| Recherche                     | Recherche plein texte Postgres et pg_trgm                                                                                               |
| Statistiques de fréquentation | Plausible ou PostHog, désactivé sans clé                                                                                                |
| Erreurs                       | Sentry, désactivé sans clé                                                                                                              |
| Tests                         | Vitest (unitaires), Playwright (parcours critiques et captures), pytest (service échecs)                                                |
| PWA                           | Manifest, service worker, mode hors ligne de l'arbitrage (IndexedDB et synchronisation)                                                 |
| Mobile                        | React Native avec Expo, branché sur la même base Supabase                                                                               |

Le service Python reçoit les appels de l'application web avec une clé secrète et lit ou écrit dans Supabase avec la clé de service. Il n'est jamais exposé directement au navigateur.

Utilise les versions stables les plus récentes et consulte leur documentation officielle en cas de doute.

## 6. Direction design

- Le logo n'existe pas encore. Crée un logotype typographique provisoire : le mot « Chesspirit » en Fraunces, avec le « s » central (partagé entre _chess_ et _spirit_) en or. Tout passe par des design tokens pour changer la charte en un seul endroit.
- Palette : noir chaud `#1c1815`, crème `#f6f0e3`, papier `#fbf8f1`, or `#b08b3e`, bordeaux `#6e1c2c`, gris chaud `#6f655b`. Pas de bleu.
- Typographies : Fraunces pour les titres, EB Garamond pour les textes longs, une sans-serif très lisible pour l'interface dense (tableaux, formulaires).
- Aucune bibliothèque d'icônes générique. Pièces d'échecs, pictogrammes et illustrations sont des SVG dessinés sur mesure. Le site ne doit ni ressembler à un template ni avoir l'air généré par une IA.
- Pas de page d'accueil classique « grand titre, paragraphe, deux boutons ». Un bandeau vivant : prochain événement avec compte à rebours, puzzle jouable, derniers résultats. Un effet marquant, avec un langage clair, direct et sérieux.
- Mobile d'abord, contrastes conformes WCAG AA, zones tactiles d'au moins 44 px, pages légères pour les réseaux lents.
- Pied de page : crédit de conception avec un lien vers frejusteagboton.info.

## 7. Rôles et permissions

Un même compte peut cumuler plusieurs rôles.

| Rôle      | Droits principaux                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------- |
| visitor   | Pages publiques, classements, annuaire, contenus gratuits                                             |
| player    | Tableau de bord, inscriptions, parties, cours, achats, communauté                                     |
| parent    | Gère les comptes et inscriptions de ses enfants mineurs                                               |
| coach     | Profil public, offres, disponibilités, élèves, revenus                                                |
| arbiter   | Appariements et résultats des tournois qui lui sont assignés                                          |
| organizer | Création et gestion de ses propres tournois                                                           |
| editor    | Articles, vidéos, podcasts, leçons                                                                    |
| partner   | Tableau de bord de visibilité de son sponsoring                                                       |
| admin     | Tout voir et tout gérer, avec des sous-rôles : super_admin, admin_competitions, admin_shop, moderator |

Double authentification obligatoire pour tous les rôles d'administration. Chaque action d'administration ou d'arbitrage est inscrite dans un journal d'audit.

## 8. Périmètre fonctionnel

### 8.1 Comptes et profils

- Un compte est obligatoire pour s'inscrire à un tournoi, réserver un cours, acheter ou commenter.
- Parcours d'inscription à un tournoi : clic sur « S'inscrire », connexion ou création de compte, retour sur l'inscription pré-remplie, paiement, billet avec QR code dans le tableau de bord.
- Création de compte par numéro de téléphone avec code SMS, par e-mail ou par Google.
- Profil minimal : nom, prénom, date de naissance, sexe, ville, département, club, identifiant FIDE facultatif.
- Compte famille : un parent crée et gère les comptes de ses enfants mineurs.
- Profils pré-créés (joueurs importés de tournois passés), réclamables par numéro de téléphone ; fusion des doublons par un administrateur.
- Compte express créé sur place par un arbitre, activé ensuite par SMS.
- Consentements recueillis séparément : CGU, newsletter, profil public, droit à l'image.
- Depuis son espace, chacun peut consulter, corriger, exporter et supprimer ses données.

### 8.2 Espace joueur

- Profil : cotes Chesspirit et Elo FIDE par cadence, titres, niveau, badges, division actuelle, carte de membre avec QR code.
- Mes tournois : historique avec rang, score, performance, variation de cote, prix ; attestations en PDF.
- Mes parties : liste filtrable (adversaire, couleur, résultat, ouverture ECO, tournoi, date), lecteur interactif, analyse par moteur, annotations personnelles, téléchargement PGN unitaire ou global, lien de partage.
- Statistiques : courbe de cote, résultats par couleur, répertoire d'ouvertures, adversaires fréquents.
- Ligues et Tour, cours, achats, réglages de confidentialité et de notifications, signalement d'erreur.

### 8.3 Gestion des tournois

- **Création (assistant)** : nom, lieu, dates, partenaires ; cadence et contrôle du temps ; nombre de rondes ; système d'appariement ; ordre des départages ; catégories ; dotations et prix spéciaux ; frais ; places ; conditions (cote min/max, âge, sexe, ligue) ; présentiel ou en ligne ; homologation (compte ou non pour la cote, une ligue, le Tour) ; duplication d'un tournoi passé.
- **Formulaire d'inscription** : champs personnalisés par l'organisateur (JSON), paiement intégré, gratuité et codes promo, validation automatique ou manuelle, liste d'attente, inscriptions groupées, import CSV, inscription sur place, confirmations par SMS, WhatsApp et e-mail, liste publique des inscrits triée par cote.
- **Affiches** : générées gratuitement depuis les données du tournoi (titre, date, lieu, cadence, dotations, logos, QR code d'inscription), en A3, A4, post et story Instagram, statut WhatsApp, bannière Facebook ; export PNG et PDF ; visuels de résultats après le tournoi.
- **Systèmes** : suisse FIDE néerlandais (bbpPairings), suisse accéléré, toutes rondes simple ou aller-retour (tables de Berger), élimination directe avec départage blitz puis Armageddon, Scheveningen, par équipes, Arena, poules puis phase finale, simultanée.
- **Jour J** : pointage par QR code ; forfaits, retards, byes (demi-point ou point) ; appariements automatiques modifiables par l'arbitre avec historique ; impression des appariements, cartes de table et feuilles de notation ; saisie des résultats sur téléphone ou tablette ; mode projection ; publication en direct (Supabase Realtime) ; mode hors ligne.
- **Départages** : Buchholz, Buchholz tronqué, Sonneborn-Berger, confrontation directe, nombre de victoires, performance. Ordre choisi à la création.
- **Parties** : téléversement PGN par ronde ou en lot, saisie assistée sur échiquier, liaison automatique partie ↔ joueurs ↔ ronde ↔ tournoi, validation par l'arbitre.
- **Clôture** : classement final et prix spéciaux, calcul des cotes, points de ligue et du Tour, rapport d'arbitrage PDF, export TRF FIDE, attestations PDF, galerie photo, brouillon d'article.
- **Archives** : base nationale de toutes les parties, recherche par joueur, ouverture, résultat, période, tournoi et position ; téléchargement d'un tournoi entier en PGN.
- **Compatibilité** : import et export Swiss Manager, TRF et CSV.

### 8.4 Ligues individuelles

Saison de septembre à juin. Neuf championnats : Ligue 1, Ligue 2, Ligue Amateur, chacune en blitz, rapide et classique.

| Cadence   | Temps         | Ligue 1 et Ligue 2 (12 joueurs)                     | Ligue Amateur                |
| --------- | ------------- | --------------------------------------------------- | ---------------------------- |
| Classique | 60 min + 30 s | Toutes rondes, 11 rondes, une toutes les 2 semaines | Suisse, une journée par mois |
| Rapide    | 15 min + 10 s | Aller-retour, 22 rondes sur 4 journées              | Suisse, une journée par mois |
| Blitz     | 3 min + 2 s   | Aller-retour, 22 rondes sur 2 journées              | Suisse, une journée par mois |

- Montées et descentes : 2 descendent, 2 montent, barrage entre le 10e de la division supérieure et le 3e de la division inférieure. Tout est paramétrable par saison.
- Points 1, ½, 0 ; départage Sonneborn-Berger ; règle de Sofia en option.
- Report possible avec accord des deux joueurs et de l'arbitre, avant une date limite ; partie en ligne sous surveillance en exception. Deux forfaits non justifiés : exclusion et relégation.
- Première saison : répartition selon la cote, complétée par un tournoi de répartition.
- Licence de ligue annuelle payante. Titre par ligue et par cadence, distinction « Triple Couronne ».

### 8.5 Chesspirit Tour

- 8 à 10 étapes par saison dans plusieurs villes, dont 2 « Majeures » (coefficient 1,5).
- Barème configurable. Par défaut : 100, 80, 65, 55, 50, 45, 40, 36, 32, 29, puis un point de moins par place jusqu'à 1 ; plus 5 points de participation par étape.
- Seuls les 6 meilleurs résultats comptent.
- Classements : général, moins de 18 ans, moins de 14 ans, féminin, plus de 50 ans, amateur (sous 1600).
- Masters de fin de saison : 8 premiers du général et 2 invités.

### 8.6 Compétitions en ligne et par équipes

- Liaison du compte Lichess au profil Chesspirit (OAuth avec PKCE), création des tournois en ligne et import automatique des résultats via l'API Lichess.
- Étapes du Tour en ligne au coefficient 0,5. Cote en ligne distincte de la cote en présentiel.
- Fair-play pour les compétitions dotées : caméra, partage d'écran, arbitre en visio, commission fair-play et sanctions.
- Équipes : 4 joueurs et un remplaçant, ordre des échiquiers selon la cote, classement aux points de match ou de partie, contrainte optionnelle de mixité ou de jeunes.

### 8.7 Cote Chesspirit

- Quatre cotes par joueur : blitz, rapide, classique (présentiel) et en ligne.
- Seuls les tournois homologués modifient la cote en présentiel.
- Méthode Elo : score attendu `E = 1 / (1 + 10^((Rb - Ra) / 400))`, nouvelle cote `R' = R + K × (S - E)`.
- Coefficient K : 40 pour moins de 30 parties, ou moins de 18 ans avec une cote inférieure à 2300 ; 20 en général ; 10 pour les joueurs ayant atteint 2400.
- Amorçage : un joueur avec un Elo FIDE part de son Elo FIDE dans la cadence ; les autres partent de 1200 (configurable), marqué provisoire, puis recalculé par performance après 5 parties.
- Import mensuel des Elo FIDE depuis les listes officielles téléchargeables de la FIDE, par identifiant.
- Liste officielle publiée le premier jour de chaque mois ; historique complet et page publique sur la méthode.
- Calcul fait dans le service Python, idempotent et rejouable depuis l'historique des parties.

### 8.8 Annuaire

- Joueurs, entraîneurs, arbitres, clubs et structures (clubs, écoles, organisateurs, associations, ligues départementales, fédération, vendeurs, créateurs de contenu, médias).
- Carte « Où jouer au Bénin », recherche et filtres par département, ville, langue, niveau.
- Fiches revendicables et badge « vérifié » après validation. Offres d'emploi pour coachs et arbitres.
- Champ pays sur chaque fiche, pour l'extension à la sous-région.
- Seules les personnes qui l'ont accepté apparaissent publiquement. Pour les mineurs : profil réduit, pas de photo publique par défaut.

### 8.9 Coaching

- Offres combinant langue (fr, en, fon), modalité (présentiel, en ligne), niveau (Découverte, Débutant, Intermédiaire, Avancé, Compétition) et format (individuel, collectif).
- Plateforme ouverte : les coachs publient leurs offres, Chesspirit prélève une commission paramétrable (modèle à confirmer par le propriétaire : rends-le désactivable pour passer à « coachs Chesspirit uniquement »).
- Disponibilités, réservation et paiement, packs et abonnements, rappels, lien de visio.
- Test de niveau par puzzles, qui recommande une offre.
- Espace élève : planning, devoirs, notes, replays, progression. Espace coach : élèves, revenus, versements.
- Candidature « Devenir coach », formulaires de devis pour écoles et entreprises.

### 8.10 Boutique

- Catalogue avec catégories, variantes, stock, avis, liste de souhaits.
- Panier, codes promo, points de fidélité, cartes cadeaux, précommandes.
- Paiement Mobile Money et carte ; livraison à Cotonou, retrait ou expédition dans la sous-région ; suivi de commande.
- Commandes groupées sur devis, location de matériel pour événements.

### 8.11 Média, académie et communauté

- Vidéos, podcasts et directs par émissions, séries et saisons ; filtres par langue, niveau, thème ; transcription et positions jouables par épisode.
- Leçons gratuites par niveau et thème, puzzle du jour, défis hebdomadaires, ressources téléchargeables, glossaire et lexique en fon, cours premium.
- Adhésion gratuite ou premium, niveaux et badges du Pion au Roi, ambassadeurs et parrainage, pronostics gratuits (aucun enjeu d'argent), partie « Le public contre le maître », Chesspirit Awards.

### 8.12 Administration

- Gestion de tous les modules : utilisateurs (fiche complète, fusion, suspension), coaching, compétitions, classement, annuaire, boutique, contenus, finances, communication, partenaires, paramètres.
- Statistiques : audience, utilisateurs (actifs, fidélité, âge, sexe, département, ville, club, niveau), compétitions, classement, coaching, boutique, contenus, finances. Filtres par période, ville et activité.
- Exports CSV, Excel et PDF ; rapport mensuel par e-mail ; alertes (stock bas, tournoi presque complet, paiement échoué, réclamation en attente).

### 8.13 Pages publiques et légales

Accueil, pages de chaque menu, à propos, contact (formulaire et WhatsApp), FAQ, mentions légales, CGV, CGU, confidentialité, cookies, retours et remboursements, règlement type des tournois. Les textes légaux sont des projets, marqués « à faire valider par un juriste ».

## 9. Modèle de données, première version

Pars de cette base et améliore-la si besoin. Chaque table a `id` (uuid), `created_at`, `updated_at`.

- **Identité** : `profiles` (lié à `auth.users` ; nom, naissance, sexe, téléphone, e-mail, photo, pays, département, ville, club_id, fide_id, titres, langues, is_public, is_minor, guardian_id, claimed, verified), `user_roles`, `consents` (type, version, accordé le, retiré le).
- **Structures** : `organizations` (type : club, école, association, fédération, ligue départementale, vendeur, média), `organization_members`.
- **Professionnels** : `coach_profiles`, `arbiter_profiles` (titre, zone, disponibilités), `credentials` (justificatifs en stockage privé).
- **Classement** : `ratings` (joueur, type : blitz, rapid, classical, online ; valeur, nombre de parties, provisoire), `rating_history` (partie ou tournoi, avant, après, delta, date), `fide_ratings` (fide_id, mois, std, rapid, blitz), `rating_lists` (publications mensuelles).
- **Tournois** : `tournaments`, `tournament_staff`, `registration_forms` (champs JSON), `registrations` (statut, réponses JSON, paiement, QR code, pointage), `rounds`, `pairings` (échiquier, blancs, noirs, résultat, type de bye, forfait), `games` (PGN, ECO, ouverture, nombre de coups, source, validée par), `game_positions` (pour la recherche par position), `standings`, `tiebreak_values`, `prizes`, `posters`, `tournament_audit`.
- **Équipes** : `teams`, `team_members`, `team_matches`, `board_results`.
- **Ligues et Tour** : `seasons`, `leagues` (division, cadence, saison), `league_members`, `league_matchdays`, `league_rules`, `tour_stages` (tournoi, coefficient, majeure), `tour_points`, `scoring_scales`.
- **Coaching** : `offers`, `availability_slots`, `bookings`, `packages`, `subscriptions`, `lessons`, `homework`, `progress_notes`, `placement_results`, `payouts`.
- **Boutique** : `product_categories`, `products`, `product_variants`, `inventory_movements`, `carts`, `orders`, `order_items`, `shipments`, `promo_codes`, `loyalty_ledger`, `gift_cards`, `rentals`.
- **Paiements** : `payments` (prestataire, montant en XOF, statut, référence, objet payé), `refunds`, `invoices`.
- **Contenus** : `articles`, `media_series`, `media_episodes`, `lessons_library`, `puzzles`, `puzzle_attempts`, `resources`, `glossary_terms` (fr, en, fon).
- **Communauté** : `memberships`, `badges`, `user_badges`, `predictions`, `referrals`, `job_posts`, `sponsors`, `sponsorships`.
- **Système** : `notifications`, `feature_flags`, `audit_logs` (acteur, action, objet, avant, après, IP, date), `data_requests` (export, suppression).

## 10. Règles métier transverses

- Cadences selon la FIDE : blitz 10 minutes ou moins par joueur, rapide plus de 10 et moins de 60 minutes, classique 60 minutes ou plus.
- Montants en XOF, sans décimales. Dates stockées en UTC, affichées en Africa/Porto-Novo.
- Aucun numéro de carte ne transite ni n'est stocké chez Chesspirit : tout passe par l'agrégateur de paiement.
- Un paiement n'est « confirmé » qu'après réception du webhook signé, jamais sur simple retour du navigateur.
- Les appariements ne sont jamais modifiés sans trace : chaque changement manuel est journalisé avec son auteur.
- Les résultats et parties d'un tournoi clôturé ne changent qu'après une réclamation validée, qui relance le calcul des cotes concernées.
- Toutes les règles de ligue, de Tour et de barème sont paramétrables en base, pas codées en dur.

## 11. Sécurité et protection des données

- Row Level Security sur chaque table, avec des tests automatisés des politiques d'accès.
- Moindre privilège : chaque rôle ne voit que ce dont il a besoin ; les administrateurs voient tout, mais chaque consultation de données personnelles est journalisée.
- Double authentification pour les administrateurs ; limitation du nombre d'envois de codes SMS et des tentatives de connexion.
- Conformité au Code du numérique du Bénin (autorité : APDP) : consentements tracés ; droits d'accès, de rectification, d'export et de suppression depuis l'espace personnel ; durées de conservation par catégorie ; protection renforcée des mineurs.
- Stockage privé pour les justificatifs et documents sensibles, URL signées à durée limitée.
- Signature vérifiée sur tous les webhooks entrants.
- En-têtes de sécurité (CSP, HSTS), protection contre les injections et le CSRF, dépendances auditées.
- Fais une revue de sécurité complète (sous-agent dédié) à la fin des phases 1 et 3, et corrige ce qu'elle trouve.

## Compléments issus du dossier de projet (27 septembre 2026)

### Arborescence (8 menus principaux)

| Menu         | Pages                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| Coaching     | Cours et programmes, Nos coachs, Test de niveau, Réserver un cours, Écoles et entreprises     |
| Compétitions | Calendrier, Ligues, Chesspirit Tour, Tournois par équipes, Résultats en direct, Archives      |
| Classements  | Cote Chesspirit, Elo FIDE, Classement des ligues, Classement du Tour, Méthode de calcul       |
| Annuaire     | Joueurs, Entraîneurs, Arbitres, Clubs et structures, Où jouer au Bénin, Offres d'emploi       |
| Boutique     | Échiquiers et pièces, Pendules et livres, Accessoires, Packs et cadeaux, Location de matériel |
| Média        | Vidéos, Podcasts, En direct, Émissions                                                        |
| Académie     | Leçons par niveau, Puzzle du jour, Ressources, Lexique en fon, Cours premium                  |
| Communauté   | Adhésion membre, Badges et niveaux, Ambassadeurs, Pronostics, Chesspirit Awards               |

En haut à droite, toujours visibles : recherche, panier, « Mon compte », et un bouton d'action contextuel (« S'inscrire au prochain tournoi » ou « Réserver un cours »). « À propos », « Contact » et les pages légales sont dans le menu secondaire et le pied de page, avec le sélecteur FR/EN.

### Points précisés par le dossier

- Règle de Sofia (option de ligue) : pas de nulle proposée avant le 30e coup.
- Villes pressenties pour le Tour : Cotonou, Porto-Novo, Abomey-Calavi, Bohicon, Parakou, Natitingou.
- Émissions : Le Coup de la semaine, Échecs en fon, Au cœur de la Ligue, Portraits, Chesspirit Live.
- Prix spéciaux attribués automatiquement : meilleur jeune, meilleure joueuse, meilleur vétéran.
- Passeport du circuit : un badge par ville visitée.
- Widgets pour les clubs : classements et calendriers intégrables.
- Plan B du 3 octobre : si le site n'est pas prêt, inscriptions par formulaire simple, puis import des résultats et des parties ; chaque participant les retrouve en réclamant son profil.
- Nom : toujours « cote Chesspirit », jamais « Elo » seul.
