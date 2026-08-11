#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${GESTIFY_SUPABASE_SMOKE_ARTIFACT_DIR:-${ROOT_DIR}/.artifacts/supabase-migration-smoke}"
STATUS_ENV_FILE="${ARTIFACT_DIR}/supabase-status.env"
START_LOG="${ARTIFACT_DIR}/supabase-start.log"
LINT_LOG="${ARTIFACT_DIR}/supabase-db-lint.log"
CONTRACT_LOG="${ARTIFACT_DIR}/supabase-contract.log"
ORDER_AUDIT_LOG="${ARTIFACT_DIR}/order-rls-audit.log"
MEMBERSHIP_UNIQUENESS_LOG="${ARTIFACT_DIR}/membership-uniqueness.log"
MEMBERSHIP_UNIQUENESS_REPORT_FILE="${ARTIFACT_DIR}/membership-uniqueness-report.json"
APP_LOG="${ARTIFACT_DIR}/gestify-app.log"
AUTHENTICATED_LOSSES_LOG="${ARTIFACT_DIR}/authenticated-losses.log"
AUTHENTICATED_LOSSES_REPORT_FILE="${ARTIFACT_DIR}/authenticated-losses-report.json"
REPORT_FILE="${ARTIFACT_DIR}/supabase-migration-smoke-report.json"
APP_URL="${GESTIFY_SMOKE_APP_URL:-http://127.0.0.1:3010}"
APP_PID=""

supabase_cli() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
    return
  fi

  npx --no-install supabase "$@"
}

cleanup() {
  if [[ -n "${APP_PID:-}" ]]; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" 2>/dev/null || true
  fi

  supabase_cli stop --no-backup >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "${ROOT_DIR}"
rm -rf "${ARTIFACT_DIR}"
mkdir -p "${ARTIFACT_DIR}"

if [[ ! -f "supabase/config.toml" ]]; then
  echo "[supabase-migration-smoke] supabase/config.toml is missing." >&2
  exit 1
fi

if [[ ! -d "supabase/migrations" ]]; then
  echo "[supabase-migration-smoke] supabase/migrations is missing." >&2
  exit 1
fi

if [[ ! -f "scripts/supabase/test-membership-uniqueness.mjs" ]]; then
  echo "[supabase-migration-smoke] Membership uniqueness contract script is missing." >&2
  exit 1
fi

if [[ ! -f "scripts/supabase/test-authenticated-losses.mjs" ]]; then
  echo "[supabase-migration-smoke] Authenticated losses smoke script is missing." >&2
  exit 1
fi

MIGRATION_COUNT="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "${MIGRATION_COUNT}" -eq 0 ]]; then
  echo "[supabase-migration-smoke] No SQL migrations found." >&2
  exit 1
fi

CLI_VERSION="$(supabase_cli --version | tr -d '\r')"
echo "[supabase-migration-smoke] Supabase CLI ${CLI_VERSION}; migrations=${MIGRATION_COUNT}."

# Start a disposable local stack. Nonessential UI, analytics and media services
# are excluded, while Auth, Storage metadata, PostgREST and Kong remain present.
supabase_cli start \
  --exclude studio,imgproxy,mailpit,edge-runtime,logflare,vector,realtime \
  2>&1 | tee "${START_LOG}"

supabase_cli db lint --local --level error --fail-on error \
  2>&1 | tee "${LINT_LOG}"

supabase_cli status -o env > "${STATUS_ENV_FILE}"

set -a
# shellcheck disable=SC1090
source "${STATUS_ENV_FILE}"
set +a

: "${API_URL:?Supabase status did not export API_URL}"
: "${SERVICE_ROLE_KEY:?Supabase status did not export SERVICE_ROLE_KEY}"

PUBLIC_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
if [[ -z "${PUBLIC_KEY}" ]]; then
  echo "[supabase-migration-smoke] Supabase status did not export PUBLISHABLE_KEY or ANON_KEY." >&2
  exit 1
fi

NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLIC_KEY}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${PUBLIC_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
npm run supabase:contract 2>&1 | tee "${CONTRACT_LOG}"

NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLIC_KEY}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${PUBLIC_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
npm run orders:rls:audit 2>&1 | tee "${ORDER_AUDIT_LOG}"

NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
GESTIFY_MEMBERSHIP_UNIQUENESS_REPORT_FILE="${MEMBERSHIP_UNIQUENESS_REPORT_FILE}" \
node scripts/supabase/test-membership-uniqueness.mjs \
  2>&1 | tee "${MEMBERSHIP_UNIQUENESS_LOG}"

NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLIC_KEY}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${PUBLIC_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
NEXT_PUBLIC_APP_URL="${APP_URL}" \
./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3010 \
  > "${APP_LOG}" 2>&1 &
APP_PID="$!"

APP_READY=false
for _attempt in $(seq 1 90); do
  if ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
    echo "[supabase-migration-smoke] Gestify dev server exited before becoming ready." >&2
    tail -n 120 "${APP_LOG}" >&2 || true
    exit 1
  fi

  HTTP_STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    "${APP_URL}/api/losses" 2>/dev/null || true)"

  if [[ "${HTTP_STATUS}" == "401" ]]; then
    APP_READY=true
    break
  fi

  sleep 1
done

if [[ "${APP_READY}" != "true" ]]; then
  echo "[supabase-migration-smoke] Gestify dev server did not expose the protected losses route." >&2
  tail -n 120 "${APP_LOG}" >&2 || true
  exit 1
fi

NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLIC_KEY}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="${PUBLIC_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
GESTIFY_APP_URL="${APP_URL}" \
GESTIFY_LOSSES_SMOKE_REPORT_FILE="${AUTHENTICATED_LOSSES_REPORT_FILE}" \
node scripts/supabase/test-authenticated-losses.mjs \
  2>&1 | tee "${AUTHENTICATED_LOSSES_LOG}"

GESTIFY_SMOKE_CLI_VERSION="${CLI_VERSION}" \
GESTIFY_SMOKE_MIGRATION_COUNT="${MIGRATION_COUNT}" \
GESTIFY_SMOKE_REPORT_FILE="${REPORT_FILE}" \
node <<'NODE'
import { writeFileSync } from "node:fs";

const payload = {
  format: "gestify-supabase-migration-smoke-v2",
  ok: true,
  commit: process.env.GITHUB_SHA ?? null,
  ref: process.env.GITHUB_REF_NAME ?? null,
  supabaseCliVersion: process.env.GESTIFY_SMOKE_CLI_VERSION,
  migrationCount: Number(process.env.GESTIFY_SMOKE_MIGRATION_COUNT ?? 0),
  postgresMajorVersion: 17,
  contractValidated: true,
  orderRlsAuditValidated: true,
  membershipUniquenessValidated: true,
  authenticatedLossesValidated: true,
  generatedAt: new Date().toISOString(),
};

writeFileSync(
  process.env.GESTIFY_SMOKE_REPORT_FILE,
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify(payload, null, 2));
NODE

echo "[supabase-migration-smoke] Full migration chain, local contracts, membership uniqueness and authenticated losses flow passed."
