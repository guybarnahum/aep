#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${D1_DATABASE_NAME:?D1_DATABASE_NAME must be set}"

extract_database_id_from_info_json() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0, "utf8");
    const data = JSON.parse(input);
    const id =
      data.uuid ||
      data.database_id ||
      data.id ||
      "";
    if (id) process.stdout.write(id);
  '
}

echo "Ensuring D1 database exists" >&2
echo "  database: $D1_DATABASE_NAME" >&2

DATABASE_CREATED="false"
DATABASE_ID=""

INFO_JSON="$(npx wrangler d1 info "$D1_DATABASE_NAME" --json 2>/dev/null || true)"
if [[ -n "$INFO_JSON" ]]; then
  DATABASE_ID="$(printf '%s' "$INFO_JSON" | extract_database_id_from_info_json || true)"
fi

if [[ -z "$DATABASE_ID" ]]; then
  echo "Database not found; creating" >&2
  npx wrangler d1 create "$D1_DATABASE_NAME" >/dev/null
  DATABASE_CREATED="true"

  INFO_JSON="$(npx wrangler d1 info "$D1_DATABASE_NAME" --json)"
  DATABASE_ID="$(printf '%s' "$INFO_JSON" | extract_database_id_from_info_json || true)"
fi

if [[ -z "$DATABASE_ID" ]]; then
  echo "Failed to resolve D1 database id for $D1_DATABASE_NAME" >&2
  exit 1
fi

echo "D1 database ready" >&2
echo "  database: $D1_DATABASE_NAME" >&2
echo "  database_id: $DATABASE_ID" >&2
echo "  created: $DATABASE_CREATED" >&2

printf 'D1_DATABASE_NAME=%s\n' "$D1_DATABASE_NAME"
printf 'D1_DATABASE_ID=%s\n' "$DATABASE_ID"
printf 'D1_DATABASE_CREATED=%s\n' "$DATABASE_CREATED"