#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${OPERATOR_AGENT_D1_DATABASE_NAME:?OPERATOR_AGENT_D1_DATABASE_NAME must be set}"
: "${OPERATOR_AGENT_WRANGLER_CONFIG:?OPERATOR_AGENT_WRANGLER_CONFIG must be set}"

ENV_ARGS=()
if [[ -n "${CF_ENV:-}" ]]; then
  ENV_ARGS+=(--env "${CF_ENV}")
fi

run_query() {
  local sql="$1"
  npx wrangler d1 execute "${OPERATOR_AGENT_D1_DATABASE_NAME}" \
    --config "${OPERATOR_AGENT_WRANGLER_CONFIG}" \
    "${ENV_ARGS[@]}" \
    --remote \
    --command "${sql}"
}

require_output_contains() {
  local output="$1"
  local needle="$2"
  local label="$3"

  if ! grep -q "${needle}" <<<"${output}"; then
    echo "Schema check failed: missing ${label} (${needle})" >&2
    exit 1
  fi
}

echo "Checking operator-agent coordination schema"
echo "  env:      ${CF_ENV:-<none>}"
echo "  database: ${OPERATOR_AGENT_D1_DATABASE_NAME}"
echo "  config:   ${OPERATOR_AGENT_WRANGLER_CONFIG}"

TABLES_OUTPUT="$(run_query \
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tasks', 'task_dependencies', 'employee_messages') ORDER BY name;" \
)"
echo "${TABLES_OUTPUT}"

require_output_contains "${TABLES_OUTPUT}" "tasks" "table"
require_output_contains "${TABLES_OUTPUT}" "task_dependencies" "table"
require_output_contains "${TABLES_OUTPUT}" "employee_messages" "table"

TASK_COLUMNS_OUTPUT="$(run_query "PRAGMA table_info(tasks);")"
echo "${TASK_COLUMNS_OUTPUT}"

for column in \
  id \
  company_id \
  originating_team_id \
  assigned_team_id \
  owner_employee_id \
  assigned_employee_id \
  created_by_employee_id \
  task_type \
  title \
  status \
  payload \
  blocking_dependency_count
do
  require_output_contains "${TASK_COLUMNS_OUTPUT}" "${column}" "tasks.${column}"
done

echo "operator-agent coordination schema check passed"