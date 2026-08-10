#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
ARTIFACT_DIR="${ORDER_RLS_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/order-rls-cutover}"

fail() {
  printf '[order-rls-drill] ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

require_command docker

FIXTURE_SQL="$ROOT_DIR/scripts/rls/order-cutover-fixture.sql"
VERIFY_SQL="$ROOT_DIR/scripts/rls/verify-order-cutover.sql"
CUTOVER_SQL="$ROOT_DIR/supabase/migrations/20260803213227_consolidate_order_rls_p0.sql"

[[ -s "$FIXTURE_SQL" ]] || fail "fixture SQL ausente: $FIXTURE_SQL"
[[ -s "$VERIFY_SQL" ]] || fail "verificação SQL ausente: $VERIFY_SQL"
[[ -s "$CUTOVER_SQL" ]] || fail "migration de cutover ausente: $CUTOVER_SQL"

mkdir -p "$ARTIFACT_DIR"
ARTIFACT_DIR="$(cd "$ARTIFACT_DIR" && pwd)"
rm -f "$ARTIFACT_DIR"/order-rls-cutover-report-*.json

DB_CONTAINER="gestify-order-rls-${GITHUB_RUN_ID:-local}-${RANDOM}"

cleanup() {
  docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

printf '[order-rls-drill] Iniciando PostgreSQL descartável (%s).\n' "$POSTGRES_IMAGE"
docker run --detach --name "$DB_CONTAINER" \
  --env POSTGRES_PASSWORD=postgres \
  --env POSTGRES_DB=postgres \
  "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$DB_CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1 \
  || fail "PostgreSQL descartável não ficou pronto"

run_sql_file() {
  local file_path="$1"
  docker exec --interactive "$DB_CONTAINER" \
    psql -U postgres -d postgres -X --variable ON_ERROR_STOP=1 \
    < "$file_path"
}

printf '[order-rls-drill] Aplicando fixture pré-cutover insegura.\n'
run_sql_file "$FIXTURE_SQL"

printf '[order-rls-drill] Aplicando migration real de cutover.\n'
run_sql_file "$CUTOVER_SQL"

printf '[order-rls-drill] Executando matriz real de autorização entre dois tenants.\n'
run_sql_file "$VERIFY_SQL"

REPORT_FILE="$ARTIFACT_DIR/order-rls-cutover-report-$(date -u +%Y%m%dT%H%M%SZ).json"
REPORT_JSON="$(docker exec "$DB_CONTAINER" \
  psql -U postgres -d postgres -X -A -t --variable ON_ERROR_STOP=1 \
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

printf '[order-rls-drill] Cutover aprovado. relatório=%s\n' \
  "$(basename "$REPORT_FILE")"
