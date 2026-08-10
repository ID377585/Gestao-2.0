#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
DR_ARTIFACT_DIR="${DR_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/dr-fixture}"
SUPABASE_TELEMETRY_DISABLED=1
MIGRATION_VERSION="20260810000000"
export SUPABASE_TELEMETRY_DISABLED

fail() {
  printf '[dr-fixture] ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
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
SOURCE_STARTED=false

stop_source() {
  if [[ "$SOURCE_STARTED" == "true" ]]; then
    (
      cd "$SOURCE_DIR"
      "${SUPABASE_CMD[@]}" stop --no-backup >/dev/null 2>&1 || true
    )
    SOURCE_STARTED=false
  fi
}

cleanup() {
  stop_source
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$SOURCE_DIR"
(
  cd "$SOURCE_DIR"
  "${SUPABASE_CMD[@]}" init >/dev/null
  project_id="gestify-dr-source-$RANDOM-$(date +%s)"
  sed -i.bak -E "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
  rm -f supabase/config.toml.bak

  mkdir -p supabase/migrations
  cp \
    "$ROOT_DIR/scripts/dr/fixture.sql" \
    "supabase/migrations/${MIGRATION_VERSION}_dr_fixture.sql"

  "${SUPABASE_CMD[@]}" start >/dev/null
)
SOURCE_STARTED=true

SOURCE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
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

RESTORE_OUTPUT_FILE="$WORK_DIR/restore-output.txt"
: > "$RESTORE_OUTPUT_FILE"
BACKUP_FILE="$BACKUP_FILE" \
BACKUP_CHECKSUM_FILE="$CHECKSUM_FILE" \
BACKUP_PASSPHRASE="$FIXTURE_PASSPHRASE" \
DR_VERIFY_SQL="$ROOT_DIR/scripts/dr/verify-restore.sql" \
DR_REPORT_DIR="$DR_ARTIFACT_DIR" \
GITHUB_OUTPUT="$RESTORE_OUTPUT_FILE" \
  bash "$ROOT_DIR/scripts/dr/restore-encrypted-backup.sh"

RESTORE_REPORT="$(awk -F= '$1 == "restore_report" { print substr($0, index($0, "=") + 1); exit }' "$RESTORE_OUTPUT_FILE")"
[[ -s "$RESTORE_REPORT" ]] || fail "relatório do restore fixture não foi criado"

rm -f "$BACKUP_FILE" "$CHECKSUM_FILE" "${BACKUP_FILE}.metadata.json"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'fixture_restore_report=%s\n' "$RESTORE_REPORT" >> "$GITHUB_OUTPUT"
fi

printf '[dr-fixture] Drill concluído com backup criptografado, restore e teste entre tenants. relatório=%s\n' \
  "$(basename "$RESTORE_REPORT")"
