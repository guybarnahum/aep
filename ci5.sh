#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

if [[ ! -f "package.json" || ! -d "scripts/ci" ]]; then
  echo "Run this from the repo root."
  exit 1
fi

mkdir -p \
  scripts/ci/checks/environment \
  scripts/ci/checks/schema \
  scripts/ci/checks/contracts \
  scripts/ci/checks/policy \
  scripts/ci/checks/scenarios

move_with_wrapper() {
  local category="$1"
  local filename="$2"
  local src="scripts/ci/${filename}"
  local dst="scripts/ci/checks/${category}/${filename}"

  if [[ ! -f "$src" ]]; then
    echo "skip missing: $src"
    return 0
  fi

  if [[ -f "$dst" ]]; then
    echo "skip existing dst: $dst"
    return 0
  fi

  echo "move $src -> $dst"
  git mv "$src" "$dst"

  cat > "$src" <<EOF
import "./checks/${category}/${filename%.ts}";
EOF
}

patch_imports_for_moved_file() {
  local file="$1"

  # Flat CI sibling imports -> ../../...
  perl -0pi -e 's#from "\./clients/#from "../../clients/#g' "$file"
  perl -0pi -e 's#from "\./contracts/#from "../../contracts/#g' "$file"
  perl -0pi -e 's#from "\./shared/#from "../../shared/#g' "$file"
  perl -0pi -e 's#from "\./tasks/#from "../../tasks/#g' "$file"

  # Existing one-level-up CI imports -> ../../...
  perl -0pi -e 's#from "\.\./clients/#from "../../clients/#g' "$file"
  perl -0pi -e 's#from "\.\./contracts/#from "../../contracts/#g' "$file"
  perl -0pi -e 's#from "\.\./shared/#from "../../shared/#g' "$file"
  perl -0pi -e 's#from "\.\./tasks/#from "../../tasks/#g' "$file"

  # scripts/lib imports from checks/* -> ../../../lib/...
  perl -0pi -e 's#from "\.\./lib/#from "../../../lib/#g' "$file"
  perl -0pi -e 's#from "../lib/#from "../../../lib/#g' "$file"

  # Fix wrapper-like relative imports if any single quotes are used
  perl -0pi -e "s#from '\\./clients/#from '../../clients/#g" "$file"
  perl -0pi -e "s#from '\\./contracts/#from '../../contracts/#g" "$file"
  perl -0pi -e "s#from '\\./shared/#from '../../shared/#g" "$file"
  perl -0pi -e "s#from '\\./tasks/#from '../../tasks/#g" "$file"

  perl -0pi -e "s#from '\\.\\./clients/#from '../../clients/#g" "$file"
  perl -0pi -e "s#from '\\.\\./contracts/#from '../../contracts/#g" "$file"
  perl -0pi -e "s#from '\\.\\./shared/#from '../../shared/#g" "$file"
  perl -0pi -e "s#from '\\.\\./tasks/#from '../../tasks/#g" "$file"

  perl -0pi -e "s#from '\\.\\./lib/#from '../../../lib/#g" "$file"
  perl -0pi -e "s#from '../lib/#from '../../../lib/#g" "$file"
}

move_group() {
  local category="$1"
  shift
  for file in "$@"; do
    move_with_wrapper "$category" "$file"
  done
}

echo "=== CI.5 move phase ==="

move_group environment \
  check-health.ts \
  wait-for-url.ts \
  smoke-test.ts \
  async-deploy-check.ts

move_group schema \
  org-schema-check.ts \
  operator-agent-org-schema-check.ts \
  company-coordination-schema-check.ts \
  org-inventory-route-check.ts

move_group contracts \
  runtime-projection-check.ts \
  employee-scope-check.ts \
  service-provider-check.ts \
  provider-provenance-check.ts \
  runtime-provenance-check.ts \
  runtime-tenant-catalog-check.ts \
  validate-runtime-read-safety.ts

move_group policy \
  manager-policy-overlay-check.ts \
  approval-state-machine-check.ts \
  escalation-lifecycle-check.ts \
  escalation-audit-check.ts \
  manager-advisory-check.ts \
  scheduled-routing-check.ts \
  check-validation-policy.ts \
  operator-action-check.ts

move_group scenarios \
  post-deploy-validation.ts \
  dispatch-validation-runs.ts \
  execute-validation-dispatch.ts \
  execute-validation-work-order.ts \
  check-validation-verdict.ts \
  synthetic-failure-test.ts \
  paperclip-first-execution-check.ts \
  paperclip-company-handoff-check.ts \
  agent-timeout-recovery-check.ts \
  multi-worker-department-check.ts \
  run-recurring-validation.ts \
  strategic-dispatch-test.ts

echo "=== CI.5 import patch phase ==="

while IFS= read -r file; do
  patch_imports_for_moved_file "$file"
done < <(find scripts/ci/checks -type f -name "*.ts" | sort)

echo "=== CI.5 sanity output ==="
git status --short
echo
echo "Moved files now under:"
find scripts/ci/checks -maxdepth 2 -type f -name "*.ts" | sort

echo
echo "Suggested next commands:"
echo "  npm run ci:operator-surface-check"
echo "  npx tsx scripts/ci/post-deploy-validation.ts --dry-run"
echo "  npx tsc --noEmit"
