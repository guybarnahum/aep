#!/usr/bin/env bash
set -euo pipefail

: "${GIT_SHA:?GIT_SHA must be set}"

mkdir -p core/control-plane/src/generated
mkdir -p core/operator-agent/src/generated

cat > core/control-plane/src/generated/build-meta.ts <<EOF
export const BUILD_GIT_SHA = "${GIT_SHA}";
EOF

cat > core/operator-agent/src/generated/build-meta.ts <<EOF
export const BUILD_GIT_SHA = "${GIT_SHA}";
EOF

echo "Generated control-plane and operator-agent build metadata for ${GIT_SHA}"