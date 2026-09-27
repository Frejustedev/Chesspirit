# Journal des décisions

Format : date — décision — alternatives écartées — raison.

## 2026-09-27

- **Dépôt vide au démarrage** — Création du projet dans le dépôt `Frejustedev/Chesspirit`, sur la branche de travail imposée par l'environnement `claude/chesspirit-project-g1mur7` ; PR vers `main` à la fin. — Travailler sur `main` directement. — L'environnement impose la branche ; le brief prévoit ce cas.
- **Dossier de projet** — Le PDF fourni est versionné dans `docs/` et ses précisions (arborescence en 8 menus, émissions, villes du Tour, etc.) sont ajoutées à `docs/SPEC.md`. — Ignorer le PDF. — Il complète le brief sans le contredire.
- **Outils disponibles** — Node 22, pnpm 10, Python 3.12 (via uv), Postgres 16 (binaires natifs), Docker (démon démarrable) ; en revanche les registres d'images (Docker Hub, public.ecr.aws) sont bloqués par la politique réseau de la session : `supabase start` est impossible ici. — Abandonner les tests d'intégration. — Voir décision suivante.
- **Pile Supabase locale sans Docker** — `scripts/local-stack.sh` lance les composants open source de Supabase en natif : Postgres 16, PostgREST et GoTrue (binaires officiels des releases GitHub), plus une petite passerelle Node qui expose les chemins `/rest/v1` et `/auth/v1` comme Kong. Le schéma `auth` minimal et les rôles `anon`, `authenticated`, `service_role` sont créés comme dans Supabase. Realtime et Storage ne tournent pas en local : le client bascule sur du rafraîchissement périodique et un stockage sur disque via un adaptateur. Les migrations restent 100 % compatibles avec `supabase db push`. — Base en mémoire factice (ne teste pas la RLS) ; Postgres seul sans API (oblige à dupliquer l'accès aux données). — Permet de tester la vraie RLS et le vrai client supabase-js dans cet environnement ; sur une machine avec Docker, `supabase start` reste l'option standard documentée dans le README.
