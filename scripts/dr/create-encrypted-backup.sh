#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
BACKUP_OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-$ROOT_DIR/.artifacts/disaster-recovery}"
BACKUP_PREFIX="${BACKUP_PREFIX:-gestify}"
GESTIFY_DR_INCLUDE_STORAGE="${GESTIFY_DR_INCLUDE_STORAGE:-false}"

fail() {
  printf '[dr-backup] ERRO: %s\n' "$*" >&2
  exit 1
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "variável obrigatória ausente: $name"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

require_env SUPABASE_DB_URL
require_env BACKUP_PASSPHRASE
[[ ${#BACKUP_PASSPHRASE} -ge 32 ]] || fail "BACKUP_PASSPHRASE deve ter pelo menos 32 caracteres"
require_command gpg
require_command tar
require_command sha256sum
require_command node

if [[ -x "$ROOT_DIR/node_modules/.bin/supabase" ]]; then
  SUPABASE_CMD=("$ROOT_DIR/node_modules/.bin/supabase")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  fail "Supabase CLI ausente. Execute npm ci antes do backup."
fi

psql_exec() {
  if command -v psql >/dev/null 2>&1; then
    PGCONNECT_TIMEOUT=15 psql "$@"
    return
  fi

  require_command docker
  docker run --rm --network host \
    -e PGCONNECT_TIMEOUT=15 \
    "$POSTGRES_IMAGE" psql "$@"
}

safe_name() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-'
}

mkdir -p "$BACKUP_OUTPUT_DIR"
BACKUP_OUTPUT_DIR="$(cd "$BACKUP_OUTPUT_DIR" && pwd)"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gestify-dr-backup.XXXXXX")"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
RUN_SUFFIX="$(safe_name "${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}")"
BASE_NAME="${BACKUP_PREFIX}-${TIMESTAMP}-${RUN_SUFFIX}"
BUNDLE_PATH="$WORK_DIR/${BASE_NAME}.tar.gz"
ENCRYPTED_PATH="$BACKUP_OUTPUT_DIR/${BASE_NAME}.tar.gz.gpg"
CHECKSUM_PATH="$ENCRYPTED_PATH.sha256"
METADATA_PATH="$ENCRYPTED_PATH.metadata.json"

printf '[dr-backup] Gerando dump lógico oficial do Supabase...\n'
"${SUPABASE_CMD[@]}" db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$WORK_DIR/roles.sql" \
  --role-only

"${SUPABASE_CMD[@]}" db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$WORK_DIR/schema.sql"

"${SUPABASE_CMD[@]}" db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$WORK_DIR/data.sql" \
  --use-copy \
  --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

"${SUPABASE_CMD[@]}" db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$WORK_DIR/history-schema.sql" \
  --schema supabase_migrations

"${SUPABASE_CMD[@]}" db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$WORK_DIR/history-data.sql" \
  --use-copy \
  --data-only \
  --schema supabase_migrations

for required_file in \
  roles.sql \
  schema.sql \
  data.sql \
  history-schema.sql \
  history-data.sql; do
  [[ -s "$WORK_DIR/$required_file" ]] || fail "dump vazio ou ausente: $required_file"
done

SOURCE_VERSION="$(psql_exec "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select current_setting('server_version');" | tr -d '\r' | tail -n 1)"
SOURCE_DATABASE_SIZE="$(psql_exec "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select pg_database_size(current_database());" | tr -d '\r' | tail -n 1)"
PUBLIC_TABLES_WITHOUT_RLS="$(psql_exec "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "
  select count(*)
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind = 'r'
    and relation.relrowsecurity = false;
" | tr -d '\r' | tail -n 1)"

COUNTS_FILE="$WORK_DIR/critical-counts.tsv"
: > "$COUNTS_FILE"
for table_name in establishments memberships profiles products orders audit_logs; do
  exists="$(psql_exec "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
    -c "select to_regclass('public.${table_name}') is not null;" | tr -d '\r' | tail -n 1)"

  if [[ "$exists" == "t" ]]; then
    row_count="$(psql_exec "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
      -c "select count(*) from public.${table_name};" | tr -d '\r' | tail -n 1)"
    printf '%s\t%s\n' "$table_name" "$row_count" >> "$COUNTS_FILE"
  else
    printf '%s\tnull\n' "$table_name" >> "$COUNTS_FILE"
  fi
done

STORAGE_INCLUDED=false
STORAGE_FILE_COUNT=0
STORAGE_TOTAL_BYTES=0
if [[ "$GESTIFY_DR_INCLUDE_STORAGE" == "true" ]]; then
  require_command aws
  require_env SUPABASE_STORAGE_S3_ENDPOINT
  require_env SUPABASE_STORAGE_S3_ACCESS_KEY_ID
  require_env SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY

  export AWS_ACCESS_KEY_ID="$SUPABASE_STORAGE_S3_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="${SUPABASE_STORAGE_S3_REGION:-us-east-1}"

  mkdir -p "$WORK_DIR/storage"
  mapfile -t storage_buckets < <(
    aws --endpoint-url "$SUPABASE_STORAGE_S3_ENDPOINT" \
      s3api list-buckets \
      --query 'Buckets[].Name' \
      --output text | tr '\t' '\n' | sed '/^$/d'
  )

  printf '%s\n' "${storage_buckets[@]:-}" > "$WORK_DIR/storage-buckets.txt"

  for bucket_name in "${storage_buckets[@]:-}"; do
    [[ -n "$bucket_name" ]] || continue
    mkdir -p "$WORK_DIR/storage/$bucket_name"
    aws --endpoint-url "$SUPABASE_STORAGE_S3_ENDPOINT" \
      s3 sync "s3://$bucket_name" "$WORK_DIR/storage/$bucket_name" \
      --only-show-errors \
      --no-follow-symlinks
  done

  STORAGE_INCLUDED=true
  STORAGE_FILE_COUNT="$(find "$WORK_DIR/storage" -type f | wc -l | tr -d ' ')"
  STORAGE_TOTAL_BYTES="$(find "$WORK_DIR/storage" -type f -printf '%s\n' | \
    awk '{ total += $1 } END { print total + 0 }')"
fi

MANIFEST_PATH="$WORK_DIR/manifest.json"
export DR_MANIFEST_TIMESTAMP="$TIMESTAMP"
export DR_MANIFEST_SOURCE_VERSION="$SOURCE_VERSION"
export DR_MANIFEST_SOURCE_DATABASE_SIZE="$SOURCE_DATABASE_SIZE"
export DR_MANIFEST_PUBLIC_TABLES_WITHOUT_RLS="$PUBLIC_TABLES_WITHOUT_RLS"
export DR_MANIFEST_COUNTS_FILE="$COUNTS_FILE"
export DR_MANIFEST_STORAGE_INCLUDED="$STORAGE_INCLUDED"
export DR_MANIFEST_STORAGE_FILE_COUNT="$STORAGE_FILE_COUNT"
export DR_MANIFEST_STORAGE_TOTAL_BYTES="$STORAGE_TOTAL_BYTES"
export DR_MANIFEST_GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-local}"
export DR_MANIFEST_GITHUB_SHA="${GITHUB_SHA:-local}"
export DR_MANIFEST_GITHUB_RUN_ID="${GITHUB_RUN_ID:-local}"

node <<'NODE' > "$MANIFEST_PATH"
const fs = require('node:fs')
const crypto = require('node:crypto')

const counts = {}
for (const line of fs.readFileSync(process.env.DR_MANIFEST_COUNTS_FILE, 'utf8').trim().split(/\r?\n/)) {
  if (!line) continue
  const [name, raw] = line.split('\t')
  counts[name] = raw === 'null' ? null : Number(raw)
}

const sourceFingerprint = crypto
  .createHash('sha256')
  .update(`${process.env.DR_MANIFEST_SOURCE_VERSION}:${process.env.DR_MANIFEST_SOURCE_DATABASE_SIZE}`)
  .digest('hex')

const manifest = {
  format: 'gestify-supabase-logical-backup-v1',
  createdAt: process.env.DR_MANIFEST_TIMESTAMP,
  source: {
    postgresVersion: process.env.DR_MANIFEST_SOURCE_VERSION,
    databaseSizeBytes: Number(process.env.DR_MANIFEST_SOURCE_DATABASE_SIZE),
    fingerprintSha256: sourceFingerprint,
    publicTablesWithoutRls: Number(process.env.DR_MANIFEST_PUBLIC_TABLES_WITHOUT_RLS),
    criticalRowCounts: counts,
  },
  storage: {
    included: process.env.DR_MANIFEST_STORAGE_INCLUDED === 'true',
    fileCount: Number(process.env.DR_MANIFEST_STORAGE_FILE_COUNT),
    totalBytes: Number(process.env.DR_MANIFEST_STORAGE_TOTAL_BYTES),
  },
  sourceControl: {
    repository: process.env.DR_MANIFEST_GITHUB_REPOSITORY,
    commit: process.env.DR_MANIFEST_GITHUB_SHA,
    runId: process.env.DR_MANIFEST_GITHUB_RUN_ID,
  },
}

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
NODE

printf '[dr-backup] Empacotando e criptografando...\n'
tar -C "$WORK_DIR" \
  --exclude="$(basename "$BUNDLE_PATH")" \
  -czf "$BUNDLE_PATH" \
  roles.sql \
  schema.sql \
  data.sql \
  history-schema.sql \
  history-data.sql \
  manifest.json \
  critical-counts.tsv \
  $(if [[ "$STORAGE_INCLUDED" == "true" ]]; then printf '%s' 'storage storage-buckets.txt'; fi)

printf '%s' "$BACKUP_PASSPHRASE" | gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --passphrase-fd 0 \
  --symmetric \
  --cipher-algo AES256 \
  --compress-algo none \
  --output "$ENCRYPTED_PATH" \
  "$BUNDLE_PATH"

[[ -s "$ENCRYPTED_PATH" ]] || fail "arquivo criptografado não foi criado"
sha256sum "$ENCRYPTED_PATH" > "$CHECKSUM_PATH"

ENCRYPTED_SHA256="$(cut -d' ' -f1 "$CHECKSUM_PATH")"
ENCRYPTED_BYTES="$(wc -c < "$ENCRYPTED_PATH" | tr -d ' ')"
export DR_METADATA_FILE_NAME="$(basename "$ENCRYPTED_PATH")"
export DR_METADATA_SHA256="$ENCRYPTED_SHA256"
export DR_METADATA_BYTES="$ENCRYPTED_BYTES"
export DR_METADATA_CREATED_AT="$TIMESTAMP"
export DR_METADATA_STORAGE_INCLUDED="$STORAGE_INCLUDED"

node <<'NODE' > "$METADATA_PATH"
const metadata = {
  format: 'gestify-encrypted-backup-envelope-v1',
  fileName: process.env.DR_METADATA_FILE_NAME,
  sha256: process.env.DR_METADATA_SHA256,
  sizeBytes: Number(process.env.DR_METADATA_BYTES),
  createdAt: process.env.DR_METADATA_CREATED_AT,
  encryption: 'OpenPGP symmetric AES256',
  storageIncluded: process.env.DR_METADATA_STORAGE_INCLUDED === 'true',
}
process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`)
NODE

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'backup_file=%s\n' "$ENCRYPTED_PATH"
    printf 'checksum_file=%s\n' "$CHECKSUM_PATH"
    printf 'metadata_file=%s\n' "$METADATA_PATH"
    printf 'backup_name=%s\n' "$(basename "$ENCRYPTED_PATH")"
    printf 'backup_sha256=%s\n' "$ENCRYPTED_SHA256"
  } >> "$GITHUB_OUTPUT"
fi

printf '[dr-backup] Backup criptografado criado. arquivo=%s bytes=%s sha256=%s\n' \
  "$(basename "$ENCRYPTED_PATH")" \
  "$ENCRYPTED_BYTES" \
  "$ENCRYPTED_SHA256"
