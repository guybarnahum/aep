#!/usr/bin/env bash
set -euo pipefail

# inject-doc-blocks.sh
#
# Replaces blocks of the form:
#
#   <!-- BEGIN: docs/file_name.md -->
#   ... old content ...
#   <!-- END: docs/file_name.md -->
#
# with the contents of the referenced file.
#
# Usage:
#   bash scripts/ci/inject-doc-blocks.sh LLM.md .github/workflows/README.md
#
# Notes:
# - Paths in BEGIN/END markers are resolved relative to repo root.
# - Multiple injections per file are supported.
# - BEGIN and END paths must match exactly.
# - The script rewrites the file only if content changes.

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <target-file> [<target-file> ...]" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

inject_file() {
  local target="$1"
  local output="$tmp_dir/$(basename "$target").out"

  if [[ ! -f "$target" ]]; then
    echo "❌ Target file not found: $target" >&2
    exit 1
  fi

  awk -v repo_root="$repo_root" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    function begin_path(line,    m) {
      if (match(line, /^[[:space:]]*<!--[[:space:]]*BEGIN:[[:space:]]*([^[:space:]]+)[[:space:]]*-->[[:space:]]*$/, m)) {
        return m[1]
      }
      return ""
    }

    function end_path(line,    m) {
      if (match(line, /^[[:space:]]*<!--[[:space:]]*END:[[:space:]]*([^[:space:]]+)[[:space:]]*-->[[:space:]]*$/, m)) {
        return m[1]
      }
      return ""
    }

    BEGIN {
      in_block = 0
      current_path = ""
    }

    {
      if (!in_block) {
        p = begin_path($0)
        if (p != "") {
          print $0
          current_path = p
          full_path = repo_root "/" p

          if ((getline test_line < full_path) < 0) {
            print "❌ Referenced file not found: " p > "/dev/stderr"
            exit 2
          }
          close(full_path)

          while ((getline file_line < full_path) > 0) {
            print file_line
          }
          close(full_path)

          in_block = 1
          next
        }

        print $0
        next
      }

      ep = end_path($0)
      if (ep != "") {
        if (ep != current_path) {
          print "❌ END marker path mismatch in target file. Expected: " current_path ", got: " ep > "/dev/stderr"
          exit 3
        }
        print $0
        in_block = 0
        current_path = ""
      }

      next
    }

    END {
      if (in_block) {
        print "❌ Unclosed BEGIN marker for: " current_path > "/dev/stderr"
        exit 4
      }
    }
  ' "$target" > "$output"

  if ! cmp -s "$target" "$output"; then
    mv "$output" "$target"
    echo "Updated $target"
  else
    echo "No changes in $target"
  fi
}

for target in "$@"; do
  inject_file "$target"
done