#!/usr/bin/env bash
# Assemble un fichier SQL unique à coller dans l'éditeur SQL d'un projet Supabase neuf
# (installation sans CLI ni connecteur) : toutes les migrations, l'historique des migrations
# et les données de référence (sans démonstration), dans une seule transaction.
# Usage : scripts/build-production-sql.sh  →  supabase/production/installation.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/production/installation.sql"
{
  echo "-- Chesspirit : installation complète d'un projet Supabase neuf (généré par scripts/build-production-sql.sh)."
  echo "-- À exécuter UNE SEULE FOIS dans SQL Editor. En cas d'erreur, rien n'est appliqué (transaction unique)."
  echo "begin;"
  echo "set local statement_timeout = 0;"
  echo "do \$\$ begin"
  echo "  if to_regclass('public.profiles') is not null then"
  echo "    raise exception 'Chesspirit est déjà installé sur ce projet : ne pas relancer ce fichier.';"
  echo "  end if;"
  echo "end \$\$;"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo
    echo "-- ===== Migration $(basename "$f") ====="
    cat "$f"
    echo
    echo "set search_path = \"\$user\", public, extensions;"
  done
  echo
  echo "-- ===== Historique des migrations (compatible avec la CLI Supabase) ====="
  echo "create schema if not exists supabase_migrations;"
  echo "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    b="$(basename "$f" .sql)"
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('${b%%_*}', '${b#*_}') on conflict (version) do nothing;"
  done
  echo
  echo "-- ===== Données de référence (sans démonstration) ====="
  cat "$ROOT/supabase/production/reference-data.sql"
  echo
  echo "commit;"
  echo "select 'Chesspirit installé' as resultat, (select count(*) from public.feature_flags) as indicateurs, (select count(*) from public.leagues) as ligues;"
} > "$OUT"
echo "Écrit : $OUT ($(wc -c < "$OUT") octets)"
