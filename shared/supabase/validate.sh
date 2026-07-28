#!/usr/bin/env bash
# ============================================================================
# Validate every app's migrations against a real Postgres 17, and prove the RLS
# policies actually isolate two users from each other.
#
#   bash shared/supabase/validate.sh            # all apps
#   bash shared/supabase/validate.sh GHOST      # one app
#
# Needs Docker running. Nothing here touches any hosted Supabase project — it
# spins up a throwaway container and removes it on exit.
#
# The isolation test is the load-bearing part. It queries as user B with plain
# SQL, outside any app code, so a broken policy cannot be masked by the client
# remembering to filter. That is the check the standalone demos never had.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER=rsg-migration-check
IMAGE=postgres:17
APPS=("GHOST" "NEXUS" "Observatory" "The forge" "Onehand OS")
[ $# -gt 0 ] && APPS=("$@")

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fails=0

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo "${RED}Docker is not running.${OFF} Start Docker Desktop and re-run." >&2
  exit 2
fi

echo "${DIM}starting $IMAGE ...${OFF}"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || {
  echo "${RED}Postgres never became ready.${OFF}" >&2; exit 2; }

psql_db() { # $1=db, stdin=sql
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U postgres -d "$1"
}

slug_of() {
  case "$1" in
    GHOST) echo ghost ;; NEXUS) echo nexus ;; Observatory) echo observatory ;;
    "The forge") echo forge ;; "Onehand OS") echo onehand ;;
    *) echo "${1,,}" | tr -cd 'a-z0-9' ;;
  esac
}

# A user-owned table to exercise isolation on, per app.
probe_table_of() {
  case "$1" in
    ghost) echo ghost_entities ;; nexus) echo nexus_worlds ;;
    observatory) echo obs_scenarios ;; forge) echo forge_specs ;;
    onehand) echo onehand_profiles ;;
  esac
}

# Minimal valid INSERT per probe table (columns beyond user_id that are NOT NULL).
probe_insert_of() { # $1=slug $2=table $3=user-uuid
  case "$1" in
    ghost)       echo "insert into public.$2 (user_id, kind, name) values ('$3','system','probe');" ;;
    nexus)       echo "insert into public.$2 (user_id, state) values ('$3','{\"day\":1}'::jsonb);" ;;
    observatory) echo "insert into public.$2 (user_id, name) values ('$3','probe');" ;;
    forge)       echo "insert into public.$2 (user_id, name) values ('$3','probe');" ;;
    onehand)     echo "insert into public.$2 (user_id) values ('$3');" ;;
  esac
}

for app in "${APPS[@]}"; do
  slug="$(slug_of "$app")"
  db="check_$slug"
  dir="$ROOT/$app/supabase/migrations"

  printf '%-14s ' "$app"

  if [ ! -d "$dir" ]; then
    echo "${RED}FAIL${OFF}  no migrations directory at $dir"; fails=$((fails+1)); continue
  fi

  docker exec "$CONTAINER" psql -q -U postgres -c "drop database if exists $db;" >/dev/null
  docker exec "$CONTAINER" psql -q -U postgres -c "create database $db;"        >/dev/null

  if ! psql_db "$db" < "$ROOT/shared/supabase/test-shim.sql" >/dev/null 2>/tmp/rsg_err; then
    echo "${RED}FAIL${OFF}  shim: $(head -3 /tmp/rsg_err | tr '\n' ' ')"; fails=$((fails+1)); continue
  fi

  ok=1
  # Glob directly and sort with a NUL-safe read: `for m in $(ls ...)` word-splits
  # on spaces, which silently skipped "The forge" and "Onehand OS" entirely —
  # two of the five apps were never validated at all.
  mapfile -t migrations < <(printf '%s\n' "$dir"/*.sql | sort)
  for m in "${migrations[@]}"; do
    if ! psql_db "$db" < "$m" >/dev/null 2>/tmp/rsg_err; then
      echo "${RED}FAIL${OFF}  $(basename "$m")"
      sed 's/^/                 /' /tmp/rsg_err | head -6
      ok=0; fails=$((fails+1)); break
    fi
  done
  [ $ok -eq 1 ] || continue

  # ---- cross-tenant isolation -------------------------------------------
  table="$(probe_table_of "$slug")"
  A=11111111-1111-4111-8111-111111111111
  B=22222222-2222-4222-8222-222222222222

  result=$(psql_db "$db" <<SQL 2>/tmp/rsg_err || echo ERROR
\\set QUIET on
\\pset tuples_only on
insert into auth.users (id) values ('$A'), ('$B');
$(probe_insert_of "$slug" "$table" "$A")
$(probe_insert_of "$slug" "$table" "$B")

-- Read as user B, through RLS, with no application-level filter at all.
set role authenticated;
select set_config('request.jwt.claim.sub', '$B', false);
select 'SEEN=' || count(*) from public.$table;
SQL
)

  # Extract the tagged count. The previous `tail -c 3` took the last three
  # CHARACTERS of the whole psql output — which always included the uuid echoed
  # by set_config, so `seen` was never a bare number and the equality below
  # could never be true. The check was structurally incapable of passing.
  seen=$(printf '%s\n' "$result" | sed -n 's/.*SEEN=\([0-9]\{1,\}\).*/\1/p' | tail -n1)
  [ -n "$seen" ] || seen="unparsed"

  if [ "$result" = "ERROR" ]; then
    echo "${RED}FAIL${OFF}  isolation probe errored: $(head -2 /tmp/rsg_err | tr '\n' ' ')"
    fails=$((fails+1))
  elif [ "$seen" = "1" ]; then
    echo "${GREEN}ok${OFF}    migrations apply; user B sees only their own row"
  else
    echo "${RED}FAIL${OFF}  CROSS-TENANT LEAK: user B saw $seen rows in $table (expected 1)"
    fails=$((fails+1))
  fi
done

echo
if [ $fails -eq 0 ]; then
  echo "${GREEN}All checks passed.${OFF}"
else
  echo "${RED}$fails check(s) failed.${OFF}"
fi
exit $((fails > 0 ? 1 : 0))
