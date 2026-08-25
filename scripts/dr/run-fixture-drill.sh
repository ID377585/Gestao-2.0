#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
DR_ARTIFACT_DIR="${DR_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/dr-fixture}"
SUPABASE_TELEMETRY_DISABLED=1
MIGRATION_VERSION="20260810000000"
SUPABASE_EXCLUDED_SERVICES="${SUPABASE_EXCLUDED_SERVICES:-gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor}"
export SUPABASE_TELEMETRY_DISABLED

fail() {
  printf '[dr-fixture] ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

find_free_port() {
  node <<'NODE'
const net = require('node:net')
const server = net.createServer()
server.unref()
server.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
server.listen({ host: '127.0.0.1', port: 0 }, () => {
  process.stdout.write(String(server.address().port))
  server.close()
})
NODE
}

configure_supabase_db_ports() {
  local config_path="$1"
  local db_port="$2"
  local shadow_port="$3"

  node - "$config_path" "$db_port" "$shadow_port" <<'NODE'
const fs = require('node:fs')
const [configPath, dbPort, shadowPort] = process.argv.slice(2)
const lines = fs.readFileSync(configPath, 'utf8').split(/\r?\n/)
let section = ''
let changedPort = false
let changedShadow = false

for (let index = 0; index < lines.length; index += 1) {
  const sectionMatch = lines[index].match(/^\[([^\]]+)\]\s*$/)
  if (sectionMatch) {
    section = sectionMatch[1]
    continue
  }
  if (section !== 'db') continue
  if (/^port\s*=/.test(lines[index])) {
    lines[index] = `port = ${dbPort}`
    changedPort = true
  } else if (/^shadow_port\s*=/.test(lines[index])) {
    lines[index] = `shadow_port = ${shadowPort}`
    changedShadow = true
  }
}

if (!changedPort || !changedShadow) {
  throw new Error('Não foi possível localizar as portas da seção [db] do Supabase')
}
fs.writeFileSync(configPath, `${lines.join('\n')}\n`)
NODE
}

require_command docker
require_command node
require_command gpg

if [[ -x "$ROOT_DIR/node_modules/.bin/supabase" ]]; then
  SUPABASE_CMD=("$ROOT_DIR/node_modules/.bin/supabase")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  fail "Supabase CLI ausente. Execute npm ci antes do drill."
fi

mkdir -p "$DR_ARTIFACT_DIR"
DR_ARTIFACT_DIR="$(cd "$DR_ARTIFACT_DIR" && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gestify-dr-fixture.XXXXXX")"
SOURCE_DIR="$WORK_DIR/source"
TARGET_DIR="$WORK_DIR/target"
SOURCE_STARTED=false
TARGET_STARTED=false

stop_source() {
  if [[ "$SOURCE_STARTED" == "true" ]]; then
    (
      cd "$SOURCE_DIR"
      "${SUPABASE_CMD[@]}" stop --no-backup >/dev/null 2>&1 || true
    )
    SOURCE_STARTED=false
  fi
}

stop_target() {
  if [[ "$TARGET_STARTED" == "true" ]]; then
    (
      cd "$TARGET_DIR"
      "${SUPABASE_CMD[@]}" stop --no-backup >/dev/null 2>&1 || true
    )
    TARGET_STARTED=false
  fi
}

cleanup() {
  stop_target
  stop_source
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

SOURCE_DB_PORT="$(find_free_port)"
SOURCE_SHADOW_PORT="$(find_free_port)"

mkdir -p "$SOURCE_DIR"
(
  cd "$SOURCE_DIR"
  "${SUPABASE_CMD[@]}" init >/dev/null
  project_id="gestify-dr-source-$RANDOM-$(date +%s)"
  sed -i.bak -E "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
  rm -f supabase/config.toml.bak
  configure_supabase_db_ports \
    supabase/config.toml \
    "$SOURCE_DB_PORT" \
    "$SOURCE_SHADOW_PORT"

  mkdir -p supabase/migrations
  cp \
    "$ROOT_DIR/scripts/dr/fixture.sql" \
    "supabase/migrations/${MIGRATION_VERSION}_dr_fixture.sql"

  "${SUPABASE_CMD[@]}" start -x "$SUPABASE_EXCLUDED_SERVICES" >/dev/null
)
SOURCE_STARTED=true

SOURCE_DB_URL="postgresql://postgres:postgres@127.0.0.1:${SOURCE_DB_PORT}/postgres"
MIGRATION_HISTORY_COUNT="$(docker run --rm --network host \
  "$POSTGRES_IMAGE" \
  psql "$SOURCE_DB_URL" \
  -X -A -t \
  --variable ON_ERROR_STOP=1 \
  --command "select count(*) from supabase_migrations.schema_migrations where version = '${MIGRATION_VERSION}';" \
  | tr -d '\r' \
  | tail -n 1)"

[[ "$MIGRATION_HISTORY_COUNT" == "1" ]] || \
  fail "fixture não foi aplicada como migration versionada"

SOURCE_TABLES_WITHOUT_RLS="$(docker run --rm --network host \
  "$POSTGRES_IMAGE" \
  psql "$SOURCE_DB_URL" \
  -X -A -t \
  --variable ON_ERROR_STOP=1 \
  --command "
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and relation.relrowsecurity = false;
  " \
  | tr -d '\r' \
  | tail -n 1)"

[[ "$SOURCE_TABLES_WITHOUT_RLS" == "0" ]] || \
  fail "fixture de origem possui tabelas públicas sem RLS"

SOURCE_ANONYMOUS_GRANT_COUNT="$(docker run --rm --network host \
  "$POSTGRES_IMAGE" \
  psql "$SOURCE_DB_URL" \
  -X -A -t \
  --variable ON_ERROR_STOP=1 \
  --command "
    select count(*)
    from information_schema.table_privileges privilege
    where privilege.table_schema = 'public'
      and privilege.grantee in ('anon', 'PUBLIC');
  " \
  | tr -d '\r' \
  | tail -n 1)"

[[ "$SOURCE_ANONYMOUS_GRANT_COUNT" == "0" ]] || \
  fail "fixture de origem ainda expõe grants de tabela para anon/PUBLIC"

FIXTURE_PASSPHRASE="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
BACKUP_OUTPUT_FILE="$WORK_DIR/backup-output.txt"
: > "$BACKUP_OUTPUT_FILE"

SUPABASE_DB_URL="$SOURCE_DB_URL" \
BACKUP_PASSPHRASE="$FIXTURE_PASSPHRASE" \
BACKUP_OUTPUT_DIR="$DR_ARTIFACT_DIR" \
BACKUP_PREFIX="gestify-fixture" \
GESTIFY_DR_INCLUDE_STORAGE=false \
GITHUB_OUTPUT="$BACKUP_OUTPUT_FILE" \
  bash "$ROOT_DIR/scripts/dr/create-encrypted-backup.sh"

BACKUP_FILE="$(awk -F= '$1 == "backup_file" { print substr($0, index($0, "=") + 1); exit }' "$BACKUP_OUTPUT_FILE")"
CHECKSUM_FILE="$(awk -F= '$1 == "checksum_file" { print substr($0, index($0, "=") + 1); exit }' "$BACKUP_OUTPUT_FILE")"
[[ -s "$BACKUP_FILE" ]] || fail "backup fixture não foi criado"
[[ -s "$CHECKSUM_FILE" ]] || fail "checksum fixture não foi criado"

stop_source

# Start the disposable restore target explicitly on free ports. Passing it as an
# external disposable target prevents collisions with the Supabase CLI defaults
# when hosted runners retain or concurrently expose port 54322.
TARGET_DB_PORT="$(find_free_port)"
TARGET_SHADOW_PORT="$(find_free_port)"
mkdir -p "$TARGET_DIR"
(
  cd "$TARGET_DIR"
  "${SUPABASE_CMD[@]}" init >/dev/null
  project_id="gestify-dr-target-$RANDOM-$(date +%s)"
  sed -i.bak -E "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
  rm -f supabase/config.toml.bak
  configure_supabase_db_ports \
    supabase/config.toml \
    "$TARGET_DB_PORT" \
    "$TARGET_SHADOW_PORT"
  "${SUPABASE_CMD[@]}" start -x "$SUPABASE_EXCLUDED_SERVICES" >/dev/null
)
TARGET_STARTED=true
TARGET_DB_URL="postgresql://postgres:postgres@127.0.0.1:${TARGET_DB_PORT}/postgres"

RESTORE_OUTPUT_FILE="$WORK_DIR/restore-output.txt"
: > "$RESTORE_OUTPUT_FILE"
BACKUP_FILE="$BACKUP_FILE" \
BACKUP_CHECKSUM_FILE="$CHECKSUM_FILE" \
BACKUP_PASSPHRASE="$FIXTURE_PASSPHRASE" \
DR_TARGET_DB_URL="$TARGET_DB_URL" \
DR_TARGET_CONFIRMATION="RESTORE_TO_DISPOSABLE_TARGET" \
DR_VERIFY_SQL="$ROOT_DIR/scripts/dr/verify-restore.sql" \
DR_REPORT_DIR="$DR_ARTIFACT_DIR" \
SUPABASE_EXCLUDED_SERVICES="$SUPABASE_EXCLUDED_SERVICES" \
GITHUB_OUTPUT="$RESTORE_OUTPUT_FILE" \
  bash "$ROOT_DIR/scripts/dr/restore-encrypted-backup.sh"

RESTORE_REPORT="$(awk -F= '$1 == "restore_report" { print substr($0, index($0, "=") + 1); exit }' "$RESTORE_OUTPUT_FILE")"
[[ -s "$RESTORE_REPORT" ]] || fail "relatório do restore fixture não foi criado"

stop_target
rm -f "$BACKUP_FILE" "$CHECKSUM_FILE" "${BACKUP_FILE}.metadata.json"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'fixture_restore_report=%s\n' "$RESTORE_REPORT" >> "$GITHUB_OUTPUT"
fi

printf '[dr-fixture] Drill concluído com backup criptografado, restore e teste entre tenants. relatório=%s\n' \
  "$(basename "$RESTORE_REPORT")"
