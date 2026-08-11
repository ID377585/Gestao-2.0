#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-plan}"
CONFIRMATION="${2:-}"
ARTIFACT_DIR="${STAGING_ARTIFACT_DIR:-.artifacts/supabase-staging}"
STAGING_PROJECT_NAME="${STAGING_PROJECT_NAME:-gestify-staging}"
STAGING_EXPECTED_REGION="${STAGING_EXPECTED_REGION:-sa-east-1}"

case "$ACTION" in
  plan|apply|verify)
    ;;
  *)
    echo "[supabase-staging] Ação inválida: $ACTION. Use plan, apply ou verify." >&2
    exit 1
    ;;
esac

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[supabase-staging] Comando obrigatório ausente: $1." >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[supabase-staging] Variável obrigatória ausente: $name." >&2
    exit 1
  fi
}

require_command node
require_command npm
require_command supabase

require_env TARGET_ENVIRONMENT
require_env SUPABASE_ACCESS_TOKEN
require_env STAGING_PROJECT_ID
require_env PRODUCTION_PROJECT_ID
require_env STAGING_DB_PASSWORD

if [[ "$ACTION" == "apply" || "$ACTION" == "verify" ]]; then
  require_env STAGING_SUPABASE_URL
  require_env STAGING_SUPABASE_SERVICE_ROLE_KEY
fi

mkdir -p "$ARTIFACT_DIR"
PROJECTS_JSON="$ARTIFACT_DIR/projects.json"
GUARD_SUMMARY="$ARTIFACT_DIR/target-validation.log"
DRY_RUN_LOG="$ARTIFACT_DIR/migration-dry-run.log"
MIGRATION_LIST_LOG="$ARTIFACT_DIR/migration-list.log"
LINT_LOG="$ARTIFACT_DIR/db-lint.log"
CONTRACT_LOG="$ARTIFACT_DIR/supabase-contract.log"
ORDER_AUDIT_LOG="$ARTIFACT_DIR/order-rls-audit.json"

cleanup_projects_inventory() {
  # Project inventory is useful during the run but may enumerate unrelated
  # projects. Keep only the sanitized target-validation evidence.
  rm -f "$PROJECTS_JSON"
}
trap cleanup_projects_inventory EXIT

export STAGING_PROJECT_NAME
export STAGING_EXPECTED_REGION
export SUPABASE_DB_PASSWORD="$STAGING_DB_PASSWORD"
export GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-staging}"
export STAGING_SUPABASE_URL="${STAGING_SUPABASE_URL:-}"

supabase projects list --output json >"$PROJECTS_JSON"

node scripts/supabase/validate-staging-target.mjs \
  --action "$ACTION" \
  --confirmation "$CONFIRMATION" \
  --projects-json "$PROJECTS_JSON" \
  | tee "$GUARD_SUMMARY"

supabase link \
  --project-ref "$STAGING_PROJECT_ID" \
  --password "$STAGING_DB_PASSWORD"

supabase db push --linked --dry-run 2>&1 | tee "$DRY_RUN_LOG"

if [[ "$ACTION" == "apply" ]]; then
  echo "[supabase-staging] Aplicando migrations exclusivamente no staging validado."
  supabase db push --linked
fi

if [[ "$ACTION" == "apply" || "$ACTION" == "verify" ]]; then
  supabase migration list --linked 2>&1 | tee "$MIGRATION_LIST_LOG"
  supabase db lint --linked --level error --fail-on error 2>&1 | tee "$LINT_LOG"

  NEXT_PUBLIC_SUPABASE_URL="$STAGING_SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$STAGING_SUPABASE_SERVICE_ROLE_KEY" \
    npm run supabase:contract 2>&1 | tee "$CONTRACT_LOG"

  NEXT_PUBLIC_SUPABASE_URL="$STAGING_SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$STAGING_SUPABASE_SERVICE_ROLE_KEY" \
    node scripts/audit-order-rls.mjs --json >"$ORDER_AUDIT_LOG"

  node -e '
    const fs = require("node:fs");
    const path = process.argv[1];
    const payload = JSON.parse(fs.readFileSync(path, "utf8"));
    if (!payload.ok) {
      console.error("[supabase-staging] Auditoria RLS de pedidos inválida.");
      process.exit(1);
    }
    console.log("[supabase-staging] Auditoria RLS de pedidos OK.");
  ' "$ORDER_AUDIT_LOG"
fi

cat >"$ARTIFACT_DIR/summary.json" <<EOF_SUMMARY
{
  "ok": true,
  "action": "$ACTION",
  "target_environment": "staging",
  "staging_project_id": "$STAGING_PROJECT_ID",
  "staging_project_name": "$STAGING_PROJECT_NAME",
  "expected_region": "$STAGING_EXPECTED_REGION",
  "migrations_applied": $([[ "$ACTION" == "apply" ]] && echo true || echo false),
  "remote_contracts_verified": $([[ "$ACTION" == "apply" || "$ACTION" == "verify" ]] && echo true || echo false)
}
EOF_SUMMARY

printf '[supabase-staging] Concluído: ação=%s; projeto=%s; artifacts=%s\n' \
  "$ACTION" "$STAGING_PROJECT_ID" "$ARTIFACT_DIR"
