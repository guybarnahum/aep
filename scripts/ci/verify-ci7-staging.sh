#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-ci-1-foundation}"
WORKFLOW_FILE="${2:-deploy-staging.yml}"
POLL_SECONDS="${POLL_SECONDS:-10}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd gh
require_cmd jq
require_cmd grep
require_cmd sed
require_cmd awk

echo "==> Verifying GitHub auth"
gh auth status >/dev/null

echo "==> Dispatching workflow"
gh workflow run "$WORKFLOW_FILE" --ref "$BRANCH"

echo "==> Waiting for run to appear"
RUN_ID=""
for _ in $(seq 1 30); do
  RUN_ID="$(gh run list \
    --workflow "$WORKFLOW_FILE" \
    --branch "$BRANCH" \
    --limit 1 \
    --json databaseId,status,conclusion,headBranch \
    | jq -r '.[0].databaseId // empty')"

  if [[ -n "$RUN_ID" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$RUN_ID" ]]; then
  echo "Failed to find dispatched run for $WORKFLOW_FILE on $BRANCH" >&2
  exit 1
fi

echo "==> Watching run: $RUN_ID"
gh run watch "$RUN_ID" --interval "$POLL_SECONDS"

echo "==> Fetching final run metadata"
RUN_JSON="$(gh run view "$RUN_ID" --json databaseId,status,conclusion,workflowName,headBranch,url,jobs)"
echo "$RUN_JSON" | jq .

CONCLUSION="$(echo "$RUN_JSON" | jq -r '.conclusion')"
if [[ "$CONCLUSION" != "success" ]]; then
  echo "Run conclusion is not success: $CONCLUSION" >&2
  echo "Run URL: $(echo "$RUN_JSON" | jq -r '.url')" >&2
  exit 1
fi

echo "==> Validating expected jobs are present"
JOB_NAMES="$(echo "$RUN_JSON" | jq -r '.jobs[].name')"

expected_jobs=(
  "test"
  "deploy-staging-env"
  "validate-staging-environment"
  "validate-staging-schema"
  "validate-staging-contracts"
  "validate-staging-policy"
  "validate-staging-scenarios"
  "deploy-dashboard-pages"
  "final-summary"
)

for job in "${expected_jobs[@]}"; do
  if ! grep -Eq "^${job}($| / )" <<<"$JOB_NAMES"; then
    echo "Missing expected job: $job" >&2
    echo "Observed jobs:" >&2
    echo "$JOB_NAMES" >&2
    exit 1
  fi
done

echo "==> Job graph looks correct"

LOG_DIR="$(mktemp -d)"
echo "==> Downloading logs to $LOG_DIR"
gh run view "$RUN_ID" --log > "$LOG_DIR/full.log"

echo "==> Checking for expected layered summary lines"
required_summary_patterns=(
  "Environment layer:"
  "Schema layer:"
  "Contracts layer:"
  "Policy layer:"
  "Scenarios layer:"
  "Dashboard deploy:"
  "Lane verdict"
)

for pat in "${required_summary_patterns[@]}"; do
  if ! grep -Fq "$pat" "$LOG_DIR/full.log"; then
    echo "Missing expected summary pattern in logs: $pat" >&2
    exit 1
  fi
done

echo "==> Checking scenario layer wording in reusable workflow summary"
if ! grep -Fq "Layer: scenarios" "$LOG_DIR/full.log"; then
  echo "Missing 'Layer: scenarios' marker in logs" >&2
  exit 1
fi

echo "==> Ensuring old aggregate wording is gone"
for old_pat in \
  "Control-plane smoke:"; do
  if grep -Fq "$old_pat" "$LOG_DIR/full.log"; then
    echo "Found legacy wording that should be gone from aggregate summary: $old_pat" >&2
    exit 1
  fi
done

echo "==> Checking that layered reusable workflows were actually invoked"
layer_job_markers=(
  "## Environment layer validation"
  "## Schema layer validation"
  "## Contracts layer validation"
  "## Policy layer validation"
  "## Post-deploy validation"
)

for pat in "${layer_job_markers[@]}"; do
  if ! grep -Fq "$pat" "$LOG_DIR/full.log"; then
    echo "Missing expected layer job marker in logs: $pat" >&2
    exit 1
  fi
done

echo "==> Checking that scenario workflow uses moved checks/scenarios paths"
scenario_markers=(
  "scripts/ci/checks/scenarios/execute-validation-dispatch.ts"
  "scripts/ci/checks/scenarios/check-validation-verdict.ts"
)

for pat in "${scenario_markers[@]}"; do
  if ! grep -Fq "$pat" "$LOG_DIR/full.log"; then
    echo "Missing expected scenario script marker in logs: $pat" >&2
    exit 1
  fi
done

echo "==> Optional warning scan"
warn_like_patterns=(
  "warning:"
  "WARN:"
  "SKIP:"
)

for pat in "${warn_like_patterns[@]}"; do
  if grep -Fq "$pat" "$LOG_DIR/full.log"; then
    echo "Found attention pattern in logs: $pat"
  fi
done

echo "==> CI.7 staging verification passed"
echo "Run URL: $(echo "$RUN_JSON" | jq -r '.url')"
echo "Logs: $LOG_DIR/full.log"
