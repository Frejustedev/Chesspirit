#!/usr/bin/env bash
# Exécute les tests RLS : chaque fichier *.test.sql tourne dans une transaction annulée.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
fail=0
for f in "$DIR"/*.test.sql; do
  name="$(basename "$f")"
  out="$( { echo 'begin;'; cat "$DIR/_helpers.sql" "$f"; echo 'rollback;'; } | psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 2>&1 )" && status=0 || status=$?
  oks="$(grep -c 'ok - ' <<<"$out" || true)"
  if [ "$status" -ne 0 ]; then
    echo "✗ $name"; grep -E 'ERROR|ÉCHEC|ERREUR' <<<"$out" | head -5; fail=1
  else
    echo "✓ $name ($oks assertions)"
  fi
done
exit $fail
