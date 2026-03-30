#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${CF_ENV:?CF_ENV must be set}"
: "${D1_DATABASE_NAME:?D1_DATABASE_NAME must be set}"

WRANGLER_CONFIG="${WRANGLER_CONFIG:-core/control-plane/wrangler.toml}"
OPERATOR_AGENT_WRANGLER_CONFIG="${OPERATOR_AGENT_WRANGLER_CONFIG:-core/operator-agent/wrangler.jsonc}"
: "${OPERATOR_AGENT_D1_DATABASE_NAME:?OPERATOR_AGENT_D1_DATABASE_NAME must be set}"

echo "Applying D1 migrations (control-plane)"
echo "  env:      ${CF_ENV}"
echo "  database: ${D1_DATABASE_NAME}"
echo "  config:   ${WRANGLER_CONFIG}"

npx wrangler d1 migrations apply "${D1_DATABASE_NAME}" \
  --config "${WRANGLER_CONFIG}" \
  --env "${CF_ENV}" \
  --remote

echo "Applying D1 migrations (operator-agent)"
echo "  env:      ${CF_ENV}"
echo "  database: ${OPERATOR_AGENT_D1_DATABASE_NAME}"
echo "  config:   ${OPERATOR_AGENT_WRANGLER_CONFIG}"

npx wrangler d1 migrations apply "${OPERATOR_AGENT_D1_DATABASE_NAME}" \
  --config "${OPERATOR_AGENT_WRANGLER_CONFIG}" \
  --env "${CF_ENV}" \
  --remote