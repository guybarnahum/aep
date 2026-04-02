#!/usr/bin/env bash
set -euo pipefail

: "${PREVIEW_TEMPLATE_PATH:?PREVIEW_TEMPLATE_PATH must be set}"
: "${PREVIEW_OUTPUT_PATH:?PREVIEW_OUTPUT_PATH must be set}"
: "${PREVIEW_WORKER_NAME:?PREVIEW_WORKER_NAME must be set}"
: "${PREVIEW_D1_DATABASE_NAME:?PREVIEW_D1_DATABASE_NAME must be set}"
: "${PREVIEW_D1_DATABASE_ID:?PREVIEW_D1_DATABASE_ID must be set}"
: "${PREVIEW_KEY:?PREVIEW_KEY must be set}"

mkdir -p "$(dirname "$PREVIEW_OUTPUT_PATH")"

sed \
  -e "s|__WORKER_NAME__|${PREVIEW_WORKER_NAME}|g" \
  -e "s|__DB_NAME__|${PREVIEW_D1_DATABASE_NAME}|g" \
  -e "s|__DB_ID__|${PREVIEW_D1_DATABASE_ID}|g" \
  -e "s|__PREVIEW_KEY__|${PREVIEW_KEY}|g" \
  "$PREVIEW_TEMPLATE_PATH" > "$PREVIEW_OUTPUT_PATH"

echo "Generated preview Wrangler config"
echo "  template: $PREVIEW_TEMPLATE_PATH"
echo "  output:   $PREVIEW_OUTPUT_PATH"
echo "  worker:   $PREVIEW_WORKER_NAME"
echo "  database: $PREVIEW_D1_DATABASE_NAME"