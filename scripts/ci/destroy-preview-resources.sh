#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${PREVIEW_WORKER_NAME:?PREVIEW_WORKER_NAME must be set}"
: "${PREVIEW_D1_DATABASE_NAME:?PREVIEW_D1_DATABASE_NAME must be set}"

echo "Destroying preview resources"
echo "  worker:   $PREVIEW_WORKER_NAME"
echo "  database: $PREVIEW_D1_DATABASE_NAME"

WORKER_STATUS="deleted"
DATABASE_STATUS="deleted"

if ! npx wrangler delete "$PREVIEW_WORKER_NAME" --force 2>/dev/null; then
  WORKER_STATUS="missing-or-delete-failed"
fi

if ! printf 'y\n' | npx wrangler d1 delete "$PREVIEW_D1_DATABASE_NAME" 2>/dev/null; then
  DATABASE_STATUS="missing-or-delete-failed"
fi

echo "Preview resource cleanup result"
echo "  worker_status: $WORKER_STATUS"
echo "  database_status: $DATABASE_STATUS"

printf 'PREVIEW_WORKER_STATUS=%s\n' "$WORKER_STATUS"
printf 'PREVIEW_DATABASE_STATUS=%s\n' "$DATABASE_STATUS"