#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
ARTIFACT_DIR="${ORDER_RLS_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/order-rls-cutover}"
SUPABASE_EXCLUDED_SERVICES="${SUPABASE_EXCLUDED_SERVICES:-gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor}"
SUPABASE_TELEMETRY_DISABLED=1
export SUPABASE_TELEMETRY_DISABLED

fail() {
  printf '[order-rls-drill] ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

require_command docker
require_command node

if [[ -x "$ROOT_DIR/node_modules/.bin/supabase" ]]; then
  SUPABASE_CMD=("$ROOT_DIR/node_modules/.bin/supabase")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  fail "Supabase CLI ausente. Execute npm ci antes do drill."
fi

FIXTURE_SQL="$ROOT_DIR/scripts/rls/order-cutover-fixture.sql"
VERIFY_SQL="$ROOT_DIR/scripts/rls/verify-order-cutover.sql"
CUTOVER_SQL="$ROOT_DIR/supabase/migrations/20260803213227_consolidate_order_rls_p0.sql"

[[ -s "$FIXTURE_SQL" ]] || fail "fixture SQL ausente: $FIXTURE_SQL"
[[ -s "$VERIFY_SQL" ]] || fail "verificação SQL ausente: $VERIFY_SQL"
[[ -s "$CUTOVER_SQL" ]] || fail "migration de cutover ausente: $CUTOVER_SQL"

mkdir -p "$ARTIFACT_DIR"
ARTIFACT_DIR="$(cd "$ARTIFACT_DIR" && pwd)"
rm -f "$ARTIFACT_DIR"/order-rls-cutover-report-*.json

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gestify-order-rls.XXXXXX")"
PROJECT_DIR="$WORK_DIR/project"
STACK_STARTED=false

cleanup() {
  if [[ "$STACK_STARTED" == "true" ]]; then
    (
      cd "$PROJECT_DIR"
      "${SUPABASE_CMD[@]}" stop --no-backup >/dev/null 2>&1 || true
    )
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$PROJECT_DIR"
(
  cd "$PROJECT_DIR"
  "${SUPABASE_CMD[@]}" init >/dev/null
  project_id="gestify-order-rls-$RANDOM-$(date +%s)"
  sed -i.bak -E "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
  rm -f supabase/config.toml.bak

  mkdir -p supabase/migrations
  cp "$FIXTURE_SQL" \
    supabase/migrations/20260810000000_order_cutover_fixture.sql
  cp "$CUTOVER_SQL" \
    supabase/migrations/20260810000001_order_cutover.sql

  "${SUPABASE_CMD[@]}" start -x "$SUPABASE_EXCLUDED_SERVICES" >/dev/null
)
STACK_STARTED=true

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Run the full authorization matrix as actual authenticated SQL sessions.
docker run --rm --network host \
  -v "$ROOT_DIR:/workspace:ro" \
  "$POSTGRES_IMAGE" \
  psql "$DB_URL" \
  -X \
  --variable ON_ERROR_STOP=1 \
  --file /workspace/scripts/rls/verify-order-cutover.sql

REPORT_FILE="$ARTIFACT_DIR/order-rls-cutover-report-$(date -u +%Y%m%dT%H%M%SZ).json"
REPORT_JSON="$(docker run --rm --network host \
  "$POSTGRES_IMAGE" \
  psql "$DB_URL" \
  -X -A -t \
  --variable ON_ERROR_STOP=1 \
  --command "
    select jsonb_pretty(jsonb_build_object(
      'format', 'gestify-order-rls-cutover-report-v1',
      'ok', true,
      'ordersPolicies', (
        select count(*)
        from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'orders'
      ),
      'eventPolicies', (
        select count(*)
        from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'order_status_events'
      ),
      'orders', (select count(*) from public.orders),
      'events', (select count(*) from public.order_status_events),
      'anonymousTableGrants', (
        select count(*)
        from information_schema.table_privileges privilege
        where privilege.table_schema = 'public'
          and privilege.table_name in ('orders', 'order_status_events')
          and privilege.grantee in ('anon', 'PUBLIC')
      ),
      'authenticatedOrderUpdateColumns', (
        select coalesce(
          jsonb_agg(privilege.column_name order by privilege.column_name),
          '[]'::jsonb
        )
        from information_schema.column_privileges privilege
        where privilege.table_schema = 'public'
          and privilege.table_name = 'orders'
          and privilege.grantee = 'authenticated'
          and privilege.privilege_type = 'UPDATE'
      ),
      'duplicateEventTriggers', (
        select count(*)
        from pg_catalog.pg_trigger trigger
        join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
        join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
        where trigger.tgisinternal = false
          and namespace.nspname = 'public'
          and relation.relname = 'orders'
          and trigger.tgname in (
            'trg_orders_insert_event',
            'trg_orders_status_change_event'
          )
      ),
      'auditVersion', public.gestify_order_rls_audit() ->> 'version',
      'membershipSourcesValidated', jsonb_build_array(
        'memberships',
        'establishment_memberships'
      )
    ));
  " | sed '/^[[:space:]]*$/d')"

[[ -n "$REPORT_JSON" ]] || fail "relatório JSON não foi gerado"
printf '%s\n' "$REPORT_JSON" > "$REPORT_FILE"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'order_rls_report=%s\n' "$REPORT_FILE" >> "$GITHUB_OUTPUT"
fi

printf '[order-rls-drill] Cutover validado com dois tenants, duas fontes de membership e timeline sem duplicação. relatório=%s\n' \
  "$(basename "$REPORT_FILE")"
