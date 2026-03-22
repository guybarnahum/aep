#!/usr/bin/env bash
set -euo pipefail

: "${GIT_SHA:?GIT_SHA must be set}"

mkdir -p core/control-plane/src/generated

cat > core/control-plane/src/generated/build-meta.ts <<EOF
export const BUILD_GIT_SHA = "${GIT_SHA}";
EOF

echo "Generated core/control-plane/src/generated/build-meta.ts for ${GIT_SHA}"