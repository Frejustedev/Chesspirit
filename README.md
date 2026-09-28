# Chesspirit

La plateforme des échecs au Bénin : coaching, compétitions, classement, annuaire, boutique, médias — un seul compte par joueur. Domaine : chesspirit.com.

- Brief : [`docs/BRIEF.md`](docs/BRIEF.md) · Spécification : [`docs/SPEC.md`](docs/SPEC.md) · Feuille de route : [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Décisions : [`docs/DECISIONS.md`](docs/DECISIONS.md) · Avancement : [`PROGRESS.md`](PROGRESS.md) · Mise en ligne : [`docs/MISE_EN_LIGNE.md`](docs/MISE_EN_LIGNE.md)

## Structure

| Dossier                 | Contenu                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `apps/web`              | Application Next.js (App Router, TypeScript strict, Tailwind v4, next-intl FR/EN)     |
| `apps/mobile`           | Application Expo (voir [`apps/mobile/README.md`](apps/mobile/README.md))              |
| `packages/shared`       | Logique pure partagée : cote Elo, départages, tables de Berger, TRF, PGN, schémas Zod |
| `services/chess-engine` | Service Python (FastAPI) : appariements bbpPairings, recalcul des cotes, documents    |
| `supabase`              | Migrations SQL (RLS sur toutes les tables), tests des politiques, configuration CLI   |
| `scripts`               | Pile locale, seed, super-administrateur, types, mise en production                    |

## Démarrer en local

Prérequis : Node 22, pnpm 10, PostgreSQL 15+ (binaires), Python 3.12 et [uv](https://docs.astral.sh/uv/) pour le service échecs. Docker est facultatif.

```bash
pnpm install
pnpm dev          # démarre Postgres + PostgREST + GoTrue + passerelle (sans Docker), puis le site sur http://localhost:3000
pnpm seed         # tournoi du 3 octobre 2026 + données de démonstration (fictives, marquées « Démonstration »)
```

Avec Docker et la CLI Supabase : `SUPABASE_CLI=1 pnpm dev` utilise `supabase start` (mêmes ports et clés).

**Connexion en local** : aucun SMS ni e-mail n'est envoyé. Les codes à 6 chiffres sont écrits dans `.local/logs/otp.log`.

Comptes de démonstration (après `pnpm seed`) :

| Compte                        | Téléphone    | Rôle                                                         |
| ----------------------------- | ------------ | ------------------------------------------------------------ |
| joueur@demo.chesspirit.local  | +22990000001 | joueur                                                       |
| arbitre@demo.chesspirit.local | +22990000005 | arbitre du blitz de démonstration                            |
| admin@demo.chesspirit.local   | +22990000009 | super-administrateur (double authentification TOTP demandée) |

Le paiement en local utilise un **fournisseur factice** : la page de paiement propose « réussi / échec / en attente » et envoie un webhook signé, comme FedaPay.

## Commandes

| Commande                                           | Rôle                                          |
| -------------------------------------------------- | --------------------------------------------- |
| `pnpm dev`                                         | Pile locale + site                            |
| `pnpm seed` / `pnpm seed --no-demo`                | Données (avec ou sans démonstration)          |
| `pnpm create-admin --email … --phone …`            | Premier compte super-administrateur           |
| `pnpm lint` · `pnpm typecheck` · `pnpm test`       | Qualité et tests unitaires                    |
| `pnpm test:rls`                                    | Tests des politiques d'accès (Postgres local) |
| `pnpm e2e`                                         | Parcours Playwright (mobile 390 px)           |
| `pnpm --filter web captures`                       | Captures des pages clés dans `docs/captures/` |
| `pnpm gen:types`                                   | Types TypeScript générés depuis le schéma     |
| `pnpm stack` · `pnpm stack:stop` · `pnpm db:reset` | Pile locale                                   |
| `cd services/chess-engine && uv run pytest`        | Tests du service échecs                       |

## Variables d'environnement

Voir [`apps/web/.env.example`](apps/web/.env.example). En local, `pnpm dev` crée `apps/web/.env.local` avec les valeurs de la pile locale. Chaque service externe (paiement, SMS, e-mail, WhatsApp, statistiques) a une implémentation factice active tant que sa clé est absente.

## Documents

- [`RAPPORT_FINAL.md`](RAPPORT_FINAL.md) : état du projet, fonctionnalités, tests, limites.
- [`docs/MISE_EN_LIGNE.md`](docs/MISE_EN_LIGNE.md) : mise en ligne pas à pas, avec `scripts/setup-production.sh`.
- [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/SECURITE.md`](docs/SECURITE.md), [`docs/SOUS_REGION.md`](docs/SOUS_REGION.md), [`PROGRESS.md`](PROGRESS.md), [`CHANGELOG.md`](CHANGELOG.md).

## Licences

Code applicatif : propriété de Chesspirit. Dépendances et obligations (Stockfish GPL, bbpPairings Apache 2.0…) : [`docs/LICENCES.md`](docs/LICENCES.md).
