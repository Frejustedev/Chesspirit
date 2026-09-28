# Chesspirit — règles permanentes

Plateforme des échecs au Bénin (chesspirit.com). Brief complet : `docs/BRIEF.md`. Spécification : `docs/SPEC.md`. Feuille de route : `docs/ROADMAP.md`.

## Protocole de reprise

À chaque démarrage, après une compaction ou sur « continue » : relire `PROGRESS.md`, `docs/DECISIONS.md` et ce fichier, puis reprendre à la « Prochaine tâche » de `PROGRESS.md`. Mettre `PROGRESS.md` à jour après chaque tâche et avant chaque push.

## Mode autonome (priorité absolue)

1. Aucune question, aucune attente : choisir l'option la plus standard, sûre et réversible, puis la noter dans `docs/DECISIONS.md` (date, décision, alternatives écartées, raison).
2. Pas d'arrêt entre les phases.
3. Un blocage externe (identifiants, comptes, clés) n'arrête jamais le travail : adaptateur + implémentation factice + ligne dans « Ce que le propriétaire doit fournir » (`docs/MISE_EN_LIGNE.md`).
4. Interdits : committer un secret ; forcer un push ou réécrire l'historique distant ; créer un compte tiers ou dépenser ; envoyer de vrais SMS/e-mails/WhatsApp/paiements ; déployer en production ; présenter une information inventée comme réelle (données de démo marquées « démonstration » ; faits inconnus du tournoi du 3 octobre 2026 = « À confirmer », modifiables depuis l'administration).
5. Fonctionnalité qui résiste après 3 tentatives : indicateur de fonctionnalité désactivé + « À reprendre » dans `PROGRESS.md`.
6. Lint, typage et tests verts avant chaque push ; captures Playwright 390 px et 1440 px des pages clés.

## Stack

- Monorepo pnpm : `apps/web` (Next.js App Router, TS strict, Tailwind v4, next-intl), `apps/mobile` (Expo), `packages/shared` (Zod, types, logique pure : cotes, départages, appariements toutes rondes, TRF, PGN), `services/chess-engine` (Python 3.12, FastAPI, bbpPairings), `supabase` (migrations SQL, seed, tests RLS).
- Données : Supabase (Postgres + RLS partout, Auth, Storage, Realtime).
- Local sans Docker : `scripts/local-stack.sh` lance Postgres 16 natif + PostgREST + GoTrue + une passerelle compatible Supabase (voir `docs/DECISIONS.md`). Avec Docker : `supabase start` fonctionne aussi.

## Commandes

| Commande                                                                         | Rôle                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `pnpm install`                                                                   | Dépendances                               |
| `pnpm dev`                                                                       | Pile locale + application web             |
| `pnpm seed`                                                                      | Données de démonstration                  |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`                                     | Qualité                                   |
| `pnpm test:rls`                                                                  | Tests des politiques RLS (Postgres local) |
| `pnpm e2e`                                                                       | Playwright (parcours et captures)         |
| `pnpm --filter chess-engine test` ou `cd services/chess-engine && uv run pytest` | Service Python                            |

## Conventions

- Conventional Commits, petits commits, push après chaque fonctionnalité verte. Branche de travail : `claude/chesspirit-project-g1mur7` (PR vers `main` à la fin).
- Tous les textes d'interface passent par next-intl (`apps/web/messages/{fr,en}.json`).
- Montants en XOF entiers ; dates stockées en UTC, affichées en `Africa/Porto-Novo`.
- Aucune bibliothèque d'icônes : SVG maison dans `apps/web/src/components/icons`.
- Palette et typographies uniquement via les design tokens (`apps/web/src/app/tokens.css`).
- Toute nouvelle table : RLS activée + politiques + test dans `supabase/tests`.
- Fonction interne du schéma `private` (appelée seulement par des fonctions `security definer`) : `revoke execute … from public, anon, authenticated, service_role` (le schéma accorde l'exécution aux rôles d'API par défaut).
- Toute nouvelle migration porte un numéro supérieur à la dernière existante (`20261009000100` au 28 septembre 2026), même si la date du jour est antérieure.
