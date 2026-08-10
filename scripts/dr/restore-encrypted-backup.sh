#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
BACKUP_FILE="${BACKUP_FILE:-${1:-}}"
BACKUP_CHECKSUM_FILE="${BACKUP_CHECKSUM_FILE:-}"
DR_TARGET_DB_URL="${DR_TARGET_DB_URL:-}"
DR_TARGET_CONFIRMATION="${DR_TARGET_CONFIRMATION:-}"
DR_VERIFY_SQL="${DR_VERIFY_SQL:-}"
DR_REPORT_DIR="${DR_REPORT_DIR:-$ROOT_DIR/.artifacts/disaster-recovery}"
SUPABASE_TELEMETRY_DISABLED=1
export SUPABASE_TELEMETRY_DISABLED

fail() {
  printf '[dr-restore] ERRO: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório ausente: $1"
}

[[ -n "$BACKUP_FILE" ]] || fail "informe BACKUP_FILE ou o caminho como primeiro argumento"
[[ -f "$BACKUP_FILE" ]] || fail "backup não encontrado"
[[ -n "${BACKUP_PASSPHRASE:-}" ]] || fail "variável obrigatória ausente: BACKUP_PASSPHRASE"
[[ ${#BACKUP_PASSPHRASE} -ge 32 ]] || fail "BACKUP_PASSPHRASE deve ter pelo menos 32 caracteres"

require_command docker
require_command gpg
require_command tar
require_command sha256sum
require_command node

if [[ -x "$ROOT_DIR/node_modules/.bin/supabase" ]]; then
  SUPABASE_CMD=("$ROOT_DIR/node_modules/.bin/supabase")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  fail "Supabase CLI ausente. Execute npm ci antes do restore."
fi

mkdir -p "$DR_REPORT_DIR"
DR_REPORT_DIR="$(cd "$DR_REPORT_DIR" && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gestify-dr-restore.XXXXXX")"
EXTRACT_DIR="$WORK_DIR/extracted"
SANITIZED_DIR="$WORK_DIR/sanitized"
LOCAL_TARGET_DIR=""
LOCAL_TARGET_STARTED=false
START_EPOCH="$(date +%s)"

stop_local_target() {
  if [[ "$LOCAL_TARGET_STARTED" == "true" && -n "$LOCAL_TARGET_DIR" ]]; then
    (
      cd "$LOCAL_TARGET_DIR"
      "${SUPABASE_CMD[@]}" stop --no-backup >/dev/null 2>&1 || true
    )
  fi
}

cleanup() {
  stop_local_target
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

psql_docker() {
  local target_url="$1"
  shift
  docker run --rm --network host \
    -v "$SANITIZED_DIR:/restore:ro" \
    "$POSTGRES_IMAGE" \
    psql "$target_url" "$@"
}

psql_query() {
  local target_url="$1"
  local query="$2"
  docker run --rm --network host \
    "$POSTGRES_IMAGE" \
    psql "$target_url" -X -A -t -v ON_ERROR_STOP=1 -c "$query"
}

if [[ -z "$BACKUP_CHECKSUM_FILE" && -f "${BACKUP_FILE}.sha256" ]]; then
  BACKUP_CHECKSUM_FILE="${BACKUP_FILE}.sha256"
fi

if [[ -n "$BACKUP_CHECKSUM_FILE" ]]; then
  [[ -f "$BACKUP_CHECKSUM_FILE" ]] || fail "arquivo de checksum não encontrado"
  EXPECTED_SHA256="$(awk 'NF { print $1; exit }' "$BACKUP_CHECKSUM_FILE")"
  ACTUAL_SHA256="$(sha256sum "$BACKUP_FILE" | awk '{ print $1 }')"
  [[ "$EXPECTED_SHA256" == "$ACTUAL_SHA256" ]] || fail "checksum SHA-256 divergente"
else
  ACTUAL_SHA256="$(sha256sum "$BACKUP_FILE" | awk '{ print $1 }')"
fi

mkdir -p "$EXTRACT_DIR" "$SANITIZED_DIR"
BUNDLE_PATH="$WORK_DIR/backup.tar.gz"
printf '%s' "$BACKUP_PASSPHRASE" | gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --passphrase-fd 0 \
  --decrypt \
  --output "$BUNDLE_PATH" \
  "$BACKUP_FILE"

[[ -s "$BUNDLE_PATH" ]] || fail "não foi possível descriptografar o bundle"
tar -xzf "$BUNDLE_PATH" -C "$EXTRACT_DIR"

node "$ROOT_DIR/scripts/dr/sanitize-supabase-backup.mjs" \
  "$EXTRACT_DIR" \
  "$SANITIZED_DIR" >/dev/null

node - "$SANITIZED_DIR/manifest.json" <<'NODE'
const fs = require('node:fs')
const manifestPath = process.argv[2]
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (manifest.format !== 'gestify-supabase-logical-backup-v1') {
  throw new Error(`Formato de backup inesperado: ${manifest.format}`)
}
if (!manifest.source || !manifest.source.criticalRowCounts) {
  throw new Error('Manifesto não contém contagens críticas')
}
NODE

TARGET_MODE="external"
TARGET_URL="$DR_TARGET_DB_URL"
if [[ -z "$TARGET_URL" ]]; then
  TARGET_MODE="local-supabase"
  LOCAL_TARGET_DIR="$WORK_DIR/local-target"
  mkdir -p "$LOCAL_TARGET_DIR"
  (
    cd "$LOCAL_TARGET_DIR"
    "${SUPABASE_CMD[@]}" init >/dev/null
    project_id="gestify-dr-$RANDOM-$(date +%s)"
    sed -i.bak -E "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
    rm -f supabase/config.toml.bak
    "${SUPABASE_CMD[@]}" start >/dev/null
  )
  LOCAL_TARGET_STARTED=true
  TARGET_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
else
  [[ "$DR_TARGET_CONFIRMATION" == "RESTORE_TO_DISPOSABLE_TARGET" ]] || \
    fail "restore externo exige DR_TARGET_CONFIRMATION=RESTORE_TO_DISPOSABLE_TARGET"

  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    SOURCE_TARGET_SAME="$(node - "$SUPABASE_DB_URL" "$TARGET_URL" <<'NODE'
const [sourceRaw, targetRaw] = process.argv.slice(2)
const source = new URL(sourceRaw)
const target = new URL(targetRaw)
const sourceKey = `${source.hostname}:${source.port || '5432'}${source.pathname}:${source.username}`
const targetKey = `${target.hostname}:${target.port || '5432'}${target.pathname}:${target.username}`
process.stdout.write(sourceKey === targetKey ? 'true' : 'false')
NODE
)"
    [[ "$SOURCE_TARGET_SAME" != "true" ]] || fail "origem e destino do restore são o mesmo banco"
  fi

  for critical_table in establishments memberships profiles products orders; do
    table_exists="$(psql_query "$TARGET_URL" \
      "select to_regclass('public.${critical_table}') is not null;" | tr -d '\r' | tail -n 1)"
    [[ "$table_exists" != "t" ]] || \
      fail "destino externo não está vazio: public.${critical_table} já existe"
  done
fi

printf '[dr-restore] Restaurando banco em destino %s...\n' "$TARGET_MODE"
psql_docker "$TARGET_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file /restore/roles.sql \
  --file /restore/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file /restore/data.sql

psql_docker "$TARGET_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file /restore/history-schema.sql

psql_docker "$TARGET_URL" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'TRUNCATE TABLE supabase_migrations.schema_migrations' \
  --file /restore/history-data.sql

cp "$ROOT_DIR/scripts/dr/verify-live-restore.sql" "$SANITIZED_DIR/verify-live-restore.sql"
VERIFY_RESULT="$(psql_docker "$TARGET_URL" \
  -X -A -t \
  --variable ON_ERROR_STOP=1 \
  --file /restore/verify-live-restore.sql | tail -n 1)"

if [[ -n "$DR_VERIFY_SQL" ]]; then
  [[ -f "$DR_VERIFY_SQL" ]] || fail "arquivo DR_VERIFY_SQL não encontrado"
  cp "$DR_VERIFY_SQL" "$SANITIZED_DIR/verify-extra.sql"
  psql_docker "$TARGET_URL" \
    -X \
    --variable ON_ERROR_STOP=1 \
    --file /restore/verify-extra.sql >/dev/null
fi

COUNTS_EXPECTED="$WORK_DIR/expected-counts.tsv"
COUNTS_ACTUAL="$WORK_DIR/actual-counts.tsv"
node - "$SANITIZED_DIR/manifest.json" > "$COUNTS_EXPECTED" <<'NODE'
const fs = require('node:fs')
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const [table, count] of Object.entries(manifest.source.criticalRowCounts || {})) {
  if (count !== null) process.stdout.write(`${table}\t${count}\n`)
}
NODE

: > "$COUNTS_ACTUAL"
while IFS=$'\t' read -r table_name expected_count; do
  [[ -n "$table_name" ]] || continue
  actual_count="$(psql_query "$TARGET_URL" \
    "select count(*) from public.${table_name};" | tr -d '\r' | tail -n 1)"
  printf '%s\t%s\n' "$table_name" "$actual_count" >> "$COUNTS_ACTUAL"
  [[ "$actual_count" == "$expected_count" ]] || \
    fail "contagem divergente em public.${table_name}: origem=$expected_count destino=$actual_count"
done < "$COUNTS_EXPECTED"

STORAGE_MANIFEST_RESULT="$(node - "$SANITIZED_DIR/manifest.json" "$SANITIZED_DIR" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const root = process.argv[3]
let fileCount = 0
let totalBytes = 0
const storageDir = path.join(root, 'storage')
if (fs.existsSync(storageDir)) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (entry.isFile()) {
        const stat = fs.statSync(fullPath)
        fileCount += 1
        totalBytes += stat.size
      }
    }
  }
  visit(storageDir)
}
const expected = manifest.storage || { included: false, fileCount: 0, totalBytes: 0 }
const ok = !expected.included || (
  fileCount === Number(expected.fileCount) &&
  totalBytes === Number(expected.totalBytes)
)
process.stdout.write(JSON.stringify({
  ok,
  included: Boolean(expected.included),
  expectedFileCount: Number(expected.fileCount || 0),
  restoredFileCount: fileCount,
  expectedTotalBytes: Number(expected.totalBytes || 0),
  restoredTotalBytes: totalBytes,
  note: expected.included
    ? 'Objetos foram recuperados do bundle e validados; publicação em Storage alvo exige credenciais próprias.'
    : 'Backup configurado sem objetos do Storage.',
}))
NODE
)"

node -e 'const result=JSON.parse(process.argv[1]); if(!result.ok) process.exit(1)' \
  "$STORAGE_MANIFEST_RESULT" || fail "conteúdo de Storage divergiu do manifesto"

END_EPOCH="$(date +%s)"
DURATION_SECONDS="$((END_EPOCH - START_EPOCH))"
REPORT_PATH="$DR_REPORT_DIR/restore-report-$(date -u +'%Y%m%dT%H%M%SZ').json"
export DR_REPORT_BACKUP_SHA256="$ACTUAL_SHA256"
export DR_REPORT_TARGET_MODE="$TARGET_MODE"
export DR_REPORT_DURATION="$DURATION_SECONDS"
export DR_REPORT_VERIFY_RESULT="$VERIFY_RESULT"
export DR_REPORT_STORAGE_RESULT="$STORAGE_MANIFEST_RESULT"
export DR_REPORT_MANIFEST_PATH="$SANITIZED_DIR/manifest.json"
export DR_REPORT_COUNTS_PATH="$COUNTS_ACTUAL"

node <<'NODE' > "$REPORT_PATH"
const fs = require('node:fs')
const counts = {}
for (const line of fs.readFileSync(process.env.DR_REPORT_COUNTS_PATH, 'utf8').trim().split(/\r?\n/)) {
  if (!line) continue
  const [name, value] = line.split('\t')
  counts[name] = Number(value)
}
const report = {
  format: 'gestify-restore-report-v1',
  ok: true,
  verifiedAt: new Date().toISOString(),
  backupSha256: process.env.DR_REPORT_BACKUP_SHA256,
  targetMode: process.env.DR_REPORT_TARGET_MODE,
  durationSeconds: Number(process.env.DR_REPORT_DURATION),
  sourceManifest: JSON.parse(fs.readFileSync(process.env.DR_REPORT_MANIFEST_PATH, 'utf8')),
  targetCriticalRowCounts: counts,
  databaseVerification: JSON.parse(process.env.DR_REPORT_VERIFY_RESULT),
  storageBundleVerification: JSON.parse(process.env.DR_REPORT_STORAGE_RESULT),
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
NODE

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'restore_report=%s\n' "$REPORT_PATH"
    printf 'restore_duration_seconds=%s\n' "$DURATION_SECONDS"
  } >> "$GITHUB_OUTPUT"
fi

printf '[dr-restore] Restore validado. modo=%s duração=%ss relatório=%s\n' \
  "$TARGET_MODE" \
  "$DURATION_SECONDS" \
  "$(basename "$REPORT_PATH")"
