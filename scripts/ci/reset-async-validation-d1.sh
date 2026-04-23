#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${CF_ENV:?CF_ENV must be set}"
: "${OPERATOR_AGENT_D1_DATABASE_NAME:?OPERATOR_AGENT_D1_DATABASE_NAME must be set}"
: "${OPERATOR_AGENT_WRANGLER_CONFIG:?OPERATOR_AGENT_WRANGLER_CONFIG must be set}"

if [[ "${CF_ENV}" != "async_validation" ]]; then
  echo "reset-async-validation-d1.sh only supports CF_ENV=async_validation (got '${CF_ENV}')" >&2
  exit 1
fi

ENV_ARGS=(--env "${CF_ENV}")

echo "Resetting async-validation runtime data (operator-agent)"
echo "  env:      ${CF_ENV}"
echo "  database: ${OPERATOR_AGENT_D1_DATABASE_NAME}"
echo "  config:   ${OPERATOR_AGENT_WRANGLER_CONFIG}"

npx wrangler d1 execute "${OPERATOR_AGENT_D1_DATABASE_NAME}" \
  --config "${OPERATOR_AGENT_WRANGLER_CONFIG}" \
  "${ENV_ARGS[@]}" \
  --remote \
  --file scripts/ci/sql/reset-operator-agent-async-validation.sql

echo "Async-validation operator-agent runtime data reset complete."