#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

: "${BACKUP_PASSPHRASE:?GESTIFY_DR_BACKUP_PASSPHRASE is required}"
: "${GESTIFY_DR_S3_BUCKET:?GESTIFY_DR_S3_BUCKET is required}"
: "${GESTIFY_DR_S3_ACCESS_KEY_ID:?GESTIFY_DR_S3_ACCESS_KEY_ID is required}"
: "${GESTIFY_DR_S3_SECRET_ACCESS_KEY:?GESTIFY_DR_S3_SECRET_ACCESS_KEY is required}"

if [[ ${#BACKUP_PASSPHRASE} -lt 32 ]]; then
  echo "GESTIFY_DR_BACKUP_PASSPHRASE must have at least 32 characters" >&2
  exit 1
fi

for command_name in docker node gpg aws sha256sum; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required DR runner command: $command_name" >&2
    exit 1
  }
done

docker info >/dev/null

work_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/gestify-dr-preflight.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

report_dir="${DR_PREFLIGHT_REPORT_DIR:-$work_dir/report}"
mkdir -p "$report_dir"

started_epoch="$(date +%s)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
probe_id="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${RANDOM}"
plain_file="$work_dir/preflight-${probe_id}.txt"
encrypted_file="$plain_file.gpg"
downloaded_file="$work_dir/downloaded-${probe_id}.gpg"
decrypted_file="$work_dir/decrypted-${probe_id}.txt"
checksum_file="$encrypted_file.sha256"

# Synthetic-only payload. This file must never contain database contents, credentials or user data.
printf 'gestify-dr-operational-preflight\nprobe=%s\ntimestamp=%s\n' "$probe_id" "$timestamp" > "$plain_file"

gpg --batch --yes --pinentry-mode loopback \
  --passphrase "$BACKUP_PASSPHRASE" \
  --symmetric --cipher-algo AES256 \
  --output "$encrypted_file" "$plain_file"

sha256sum "$encrypted_file" > "$checksum_file"

export AWS_ACCESS_KEY_ID="$GESTIFY_DR_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$GESTIFY_DR_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${GESTIFY_DR_S3_REGION:-us-east-1}"

endpoint_args=()
if [[ -n "${GESTIFY_DR_S3_ENDPOINT:-}" ]]; then
  endpoint_args=(--endpoint-url "$GESTIFY_DR_S3_ENDPOINT")
fi

prefix="${GESTIFY_DR_S3_PREFIX:-gestify/daily}"
prefix="${prefix#/}"
prefix="${prefix%/}"
object_key="$prefix/preflight/$timestamp/preflight-${probe_id}.txt.gpg"

aws "${endpoint_args[@]}" s3api head-bucket --bucket "$GESTIFY_DR_S3_BUCKET" >/dev/null
aws "${endpoint_args[@]}" s3 cp "$encrypted_file" \
  "s3://$GESTIFY_DR_S3_BUCKET/$object_key" --only-show-errors
aws "${endpoint_args[@]}" s3 cp \
  "s3://$GESTIFY_DR_S3_BUCKET/$object_key" "$downloaded_file" --only-show-errors

expected_sha="$(cut -d ' ' -f1 "$checksum_file")"
actual_sha="$(sha256sum "$downloaded_file" | cut -d ' ' -f1)"
if [[ "$expected_sha" != "$actual_sha" ]]; then
  echo "Off-site preflight checksum mismatch" >&2
  exit 1
fi

gpg --batch --yes --pinentry-mode loopback \
  --passphrase "$BACKUP_PASSPHRASE" \
  --decrypt --output "$decrypted_file" "$downloaded_file"

cmp --silent "$plain_file" "$decrypted_file" || {
  echo "Off-site preflight decrypted payload mismatch" >&2
  exit 1
}

ended_epoch="$(date +%s)"
duration_seconds="$((ended_epoch - started_epoch))"
report_file="$report_dir/dr-operational-preflight-${timestamp}.json"

cat > "$report_file" <<JSON
{
  "ok": true,
  "mode": "synthetic-offsite-preflight",
  "productionDatabaseAccessed": false,
  "sourceDatabaseCredentialRequired": false,
  "runner": {
    "selfHostedExpected": true,
    "docker": true,
    "node": true,
    "gpg": true,
    "awsCli": true
  },
  "offsite": {
    "headBucket": true,
    "upload": true,
    "download": true,
    "checksumVerified": true,
    "decryptVerified": true
  },
  "remoteObjectRetainedForLifecycle": true,
  "durationSeconds": $duration_seconds,
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "report_file=$report_file" >> "$GITHUB_OUTPUT"
fi

echo "[dr-preflight] Safe synthetic off-site round-trip succeeded. report=$(basename "$report_file") duration=${duration_seconds}s"
