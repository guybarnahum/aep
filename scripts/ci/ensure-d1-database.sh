#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${D1_DATABASE_NAME:?D1_DATABASE_NAME must be set}"

extract_database_id() {
  sed -n 's/.*database_id *= *"\([^"]*\)".*/\1/p' | head -n1
}

echo "Ensuring D1 database exists"
echo "  database: $D1_DATABASE_NAME"

INFO_OUTPUT="$(npx wrangler d1 info "$D1_DATABASE_NAME" 2>/dev/null || true)"
DATABASE_ID="$(printf '%s\n' "$INFO_OUTPUT" | extract_database_id || true)"
DATABASE_CREATED="false"

if [[ -z "$DATABASE_ID" ]]; then
  echo "Database not found; creating"
  CREATE_OUTPUT="$(npx wrangler d1 create "$D1_DATABASE_NAME")"
  DATABASE_ID="$(printf '%s\n' "$CREATE_OUTPUT" | extract_database_id || true)"
  DATABASE_CREATED="true"
fi

if [[ -z "$DATABASE_ID" ]]; then
  echo "Failed to resolve D1 database id for $D1_DATABASE_NAME" >&2
  exit 1
fi

echo "D1 database ready"
echo "  database: $D1_DATABASE_NAME"
echo "  database_id: $DATABASE_ID"
echo "  created: $DATABASE_CREATED"

printf 'D1_DATABASE_NAME=%s\n' "$D1_DATABASE_NAME"
printf 'D1_DATABASE_ID=%s\n' "$DATABASE_ID"
printf 'D1_DATABASE_CREATED=%s\n' "$DATABASE_CREATED"