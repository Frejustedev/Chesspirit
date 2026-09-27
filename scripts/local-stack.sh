#!/usr/bin/env bash
# Pile Supabase locale sans Docker : Postgres 16 natif + PostgREST + GoTrue + passerelle Node.
# Usage : scripts/local-stack.sh start|stop|reset|status|psql
# Avec Docker disponible, `supabase start` reste l'alternative standard (mêmes ports et clés).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL="$ROOT/.local"
BIN="$LOCAL/bin"
DATA="$LOCAL/pgdata"
LOGS="$LOCAL/logs"
PG_PORT="${PG_PORT:-54322}"
REST_PORT=54330
AUTH_PORT=54329
GATEWAY_PORT="${GATEWAY_PORT:-54321}"
POSTGREST_VERSION="v12.2.12"
GOTRUE_VERSION="v2.177.0"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
DB_URL="postgresql://postgres:postgres@127.0.0.1:$PG_PORT/postgres"
export PGOPTIONS="--client-min-messages=warning"

find_pg_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then dirname "$(command -v pg_ctl)"; return; fi
  for d in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    [ -x "$d/pg_ctl" ] && { echo "$d"; return; }
  done
  echo "Postgres introuvable : installez PostgreSQL 15+ (ou utilisez 'supabase start')." >&2
  exit 1
}
PGBIN="$(find_pg_bin)"
export PATH="$PGBIN:$PATH"

download() {
  mkdir -p "$BIN"
  if [ ! -x "$BIN/postgrest" ]; then
    echo "→ Téléchargement de PostgREST $POSTGREST_VERSION"
    curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" | tar -xJ -C "$BIN"
  fi
  if [ ! -x "$BIN/auth" ]; then
    echo "→ Téléchargement de GoTrue (Supabase Auth) $GOTRUE_VERSION"
    curl -fsSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" | tar -xz -C "$BIN"
  fi
}

pg_running() { pg_isready -q -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; }

as_postgres() {
  # initdb refuse de tourner en root : on délègue à l'utilisateur « postgres » si besoin.
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$LOCAL/pgdata" "$LOGS" 2>/dev/null || true
    su postgres -s /bin/bash -c "PATH=$PGBIN:\$PATH $*"
  else
    bash -c "$*"
  fi
}

start_pg() {
  mkdir -p "$LOGS"
  if [ ! -d "$DATA" ]; then
    mkdir -p "$DATA"
    [ "$(id -u)" = "0" ] && chown -R postgres:postgres "$LOCAL" && chmod 755 "$LOCAL"
    echo "→ Initialisation de Postgres ($DATA)"
    as_postgres "initdb -D '$DATA' -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null"
    cat >> "$DATA/postgresql.conf" <<CONF
port = $PG_PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = '/tmp'
wal_level = logical
timezone = 'UTC'
CONF
    NEW_DB=1
  fi
  if ! pg_running; then
    as_postgres "pg_ctl -D '$DATA' -l '$LOGS/postgres.log' -w start >/dev/null 2>&1 </dev/null"
  fi
  if [ "${NEW_DB:-0}" = "1" ]; then
    psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/local/bootstrap.sql"
    migrate_auth
    apply_migrations
  fi
}

migrate_auth() {
  echo "→ Migrations GoTrue (schéma auth)"
  gotrue_env
  GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations" "$BIN/auth" migrate >>"$LOGS/auth.log" 2>&1 </dev/null
}

apply_migrations() {
  echo "→ Migrations Chesspirit"
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "create table if not exists public._local_migrations(name text primary key, applied_at timestamptz default now()); revoke all on public._local_migrations from anon, authenticated" 2>/dev/null
  for f in "$ROOT"/supabase/migrations/*.sql; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    if [ -z "$(psql "$DB_URL" -tAc "select 1 from public._local_migrations where name='$name'")" ]; then
      echo "   · $name"
      psql "$DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$f"
      psql "$DB_URL" -q -c "insert into public._local_migrations(name) values ('$name')"
    fi
  done
  psql "$DB_URL" -q -c "notify pgrst, 'reload schema'" || true
}

gotrue_env() {
  export GOTRUE_DB_DRIVER=postgres
  export DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$PG_PORT/postgres?search_path=auth"
  export GOTRUE_API_HOST=127.0.0.1 PORT=$AUTH_PORT
  export API_EXTERNAL_URL="http://localhost:$GATEWAY_PORT/auth/v1"
  export GOTRUE_SITE_URL="${SITE_URL:-http://localhost:3000}"
  export GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**,http://127.0.0.1:3000/**"
  export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
  export GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false
  export GOTRUE_EXTERNAL_PHONE_ENABLED=true GOTRUE_SMS_AUTOCONFIRM=false GOTRUE_SMS_OTP_EXP=600 GOTRUE_SMS_OTP_LENGTH=6
  export GOTRUE_MAILER_OTP_EXP=600 GOTRUE_MAILER_OTP_LENGTH=6
  # Local uniquement : 1 code toutes les 5 s par numéro (60 s par défaut en production).
  export GOTRUE_SMS_MAX_FREQUENCY=5s GOTRUE_SMTP_MAX_FREQUENCY=5s
  export GOTRUE_RATE_LIMIT_SMS_SENT=300 GOTRUE_RATE_LIMIT_EMAIL_SENT=30 GOTRUE_RATE_LIMIT_VERIFY=60
  export GOTRUE_MFA_TOTP_ENROLL_ENABLED=true GOTRUE_MFA_TOTP_VERIFY_ENABLED=true
  # Codes SMS et e-mails : envoyés à la passerelle locale qui les écrit dans .local/logs/otp.log.
  export GOTRUE_HOOK_SEND_SMS_ENABLED=true GOTRUE_HOOK_SEND_SMS_URI="http://localhost:$GATEWAY_PORT/hooks/send-sms"
  export GOTRUE_HOOK_SEND_SMS_SECRETS="v1,whsec_Y2hlc3NwaXJpdC1sb2NhbC1ob29rLXNlY3JldA=="
  export GOTRUE_HOOK_SEND_EMAIL_ENABLED=true GOTRUE_HOOK_SEND_EMAIL_URI="http://localhost:$GATEWAY_PORT/hooks/send-email"
  export GOTRUE_HOOK_SEND_EMAIL_SECRETS="v1,whsec_Y2hlc3NwaXJpdC1sb2NhbC1ob29rLXNlY3JldA=="
  export GOTRUE_EXTERNAL_GOOGLE_ENABLED=false
  export GOTRUE_LOG_LEVEL=warn
}

start_services() {
  gotrue_env
  if ! curl -fs "http://127.0.0.1:$AUTH_PORT/health" >/dev/null 2>&1; then
    setsid nohup "$BIN/auth" serve >>"$LOGS/auth.log" 2>&1 </dev/null & echo $! >"$LOCAL/auth.pid"
  fi
  if ! curl -fs "http://127.0.0.1:$REST_PORT/" >/dev/null 2>&1; then
    PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:$PG_PORT/postgres" \
    PGRST_DB_SCHEMAS="public" PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
    PGRST_SERVER_PORT=$REST_PORT PGRST_SERVER_HOST=127.0.0.1 PGRST_DB_EXTRA_SEARCH_PATH="public,extensions" \
    PGRST_DB_MAX_ROWS=5000 \
      setsid nohup "$BIN/postgrest" >>"$LOGS/postgrest.log" 2>&1 </dev/null & echo $! >"$LOCAL/postgrest.pid"
  fi
  if ! curl -fs "http://127.0.0.1:$GATEWAY_PORT/health" >/dev/null 2>&1; then
    GATEWAY_PORT=$GATEWAY_PORT REST_PORT=$REST_PORT AUTH_PORT=$AUTH_PORT LOCAL_DIR="$LOCAL" \
      setsid nohup node "$ROOT/scripts/gateway.mjs" >>"$LOGS/gateway.log" 2>&1 </dev/null & echo $! >"$LOCAL/gateway.pid"
  fi
  for _ in $(seq 1 40); do
    if curl -fs "http://127.0.0.1:$GATEWAY_PORT/health" >/dev/null 2>&1 \
      && curl -fs "http://127.0.0.1:$AUTH_PORT/health" >/dev/null 2>&1 \
      && curl -fs "http://127.0.0.1:$REST_PORT/" >/dev/null 2>&1; then
      echo "✓ Pile locale prête : API http://localhost:$GATEWAY_PORT · Postgres $DB_URL"
      echo "  Codes SMS / e-mail de connexion : $LOGS/otp.log"
      return 0
    fi
    sleep 0.5
  done
  echo "✗ La pile ne répond pas, voir $LOGS" >&2
  exit 1
}

stop_all() {
  for s in gateway postgrest auth; do
    if [ -f "$LOCAL/$s.pid" ]; then kill "$(cat "$LOCAL/$s.pid")" 2>/dev/null || true; rm -f "$LOCAL/$s.pid"; fi
  done
  # Filets de sécurité si les fichiers pid ont disparu.
  pkill -f "$BIN/auth serve" 2>/dev/null || true
  pkill -f "$BIN/postgrest" 2>/dev/null || true
  pkill -f "$ROOT/scripts/gateway.mjs" 2>/dev/null || true
  if [ -d "$DATA" ] && pg_running; then as_postgres "pg_ctl -D '$DATA' -m fast -w stop >/dev/null 2>&1 </dev/null"; fi
  echo "✓ Pile locale arrêtée"
}

case "${1:-start}" in
  start) download; start_pg; apply_migrations; start_services ;;
  stop) stop_all ;;
  reset) stop_all; rm -rf "$DATA" "$LOGS"; download; start_pg; start_services ;;
  migrate) apply_migrations ;;
  status) pg_running && echo "postgres: ok" || echo "postgres: arrêté"; curl -fs "http://127.0.0.1:$GATEWAY_PORT/health" && echo " gateway: ok" || echo "gateway: arrêtée" ;;
  psql) shift; psql "$DB_URL" "$@" ;;
  *) echo "Usage: $0 start|stop|reset|migrate|status|psql"; exit 1 ;;
esac
