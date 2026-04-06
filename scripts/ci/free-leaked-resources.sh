#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"

WORKER_PREFIXES=("aep-control-plane-pr-" "sample-worker-run_")
DATABASE_PREFIXES=("aep-preview-pr-" "sample-worker-run_")

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  printf '%s\n' "$1"
}

extract_pr_number_from_name() {
  local name="$1"
  if [[ "$name" =~ pr-([0-9]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

is_pr_open() {
  local pr_number="$1"
  local state

  state="$({
    curl -fsSL \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${pr_number}" \
      | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p' | head -n1
  } || true)"

  [[ "$state" == "open" ]]
}

list_preview_workers() {
  npx wrangler deployments list --name-placeholder-not-used >/dev/null 2>&1 || true
  npx wrangler whoami >/dev/null 2>&1 || true

  # Fallback: use Workers list API directly because wrangler list output is not stable enough for parsing.
  curl -fsSL \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts" \
    | tr '{},' '\n' \
    | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' \
    | grep "^${WORKER_PREFIX}" || true
}

list_preview_databases() {
  npx wrangler d1 list \
    | sed -n 's/.*│ \([^ ]*aep-preview-pr-[0-9][0-9]*\) .*/\1/p' \
    | sort -u || true
}

delete_worker() {
  local worker_name="$1"
  if npx wrangler delete "$worker_name" --force >/dev/null 2>&1; then
    log "- Deleted worker: ${worker_name}"
  else
    log "- Worker already missing or delete failed: ${worker_name}"
  fi
}

delete_database() {
  local database_name="$1"
  if printf 'y\n' | npx wrangler d1 delete "$database_name" >/dev/null 2>&1; then
    log "- Deleted D1 database: ${database_name}"
  else
    log "- D1 database already missing or delete failed: ${database_name}"
  fi
}

log "- Reaper started"
log "- Worker prefixes: ${WORKER_PREFIXES[*]}"
log "- Database prefixes: ${DATABASE_PREFIXES[*]}"
log ""


# Collect all workers matching any prefix
WORKERS=()
for prefix in "${WORKER_PREFIXES[@]}"; do
  mapfile -t found < <(
    curl -fsSL \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts" \
      | tr '{},' '\n' \
      | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' \
      | grep "^${prefix}" || true
  )
  WORKERS+=("${found[@]}")
done

# Collect all databases matching any prefix
DATABASES=()
for prefix in "${DATABASE_PREFIXES[@]}"; do
  mapfile -t found < <(
    npx wrangler d1 list \
      | sed -n "s/.*│ \([^ ]*${prefix}[0-9A-Za-z_\-]*\) .*/\1/p" \
      | sort -u || true
  )
  DATABASES+=("${found[@]}")
done

if [[ "${#WORKERS[@]}" -eq 0 && "${#DATABASES[@]}" -eq 0 ]]; then
  log "- No preview resources found."
  exit 0
fi

log "### Worker scan"
if [[ "${#WORKERS[@]}" -eq 0 ]]; then
  log "- No preview workers found."
else
  for worker in "${WORKERS[@]}"; do
    pr_number="$(extract_pr_number_from_name "$worker" || true)"

    if [[ -z "$pr_number" ]]; then
      log "- Skipped worker with unrecognized name: ${worker}"
      continue
    fi

    if is_pr_open "$pr_number"; then
      log "- Kept worker for open PR #${pr_number}: ${worker}"
    else
      delete_worker "$worker"
    fi
  done
fi

log ""
log "### D1 database scan"
if [[ "${#DATABASES[@]}" -eq 0 ]]; then
  log "- No preview D1 databases found."
else
  for database in "${DATABASES[@]}"; do
    pr_number="$(extract_pr_number_from_name "$database" || true)"

    if [[ -z "$pr_number" ]]; then
      log "- Skipped database with unrecognized name: ${database}"
      continue
    fi

    if is_pr_open "$pr_number"; then
      log "- Kept database for open PR #${pr_number}: ${database}"
    else
      delete_database "$database"
    fi
  done
fi

log ""
log "- Reaper completed"