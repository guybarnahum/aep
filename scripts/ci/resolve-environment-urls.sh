#!/usr/bin/env bash
set -euo pipefail

# Required inputs:
#   ENVIRONMENT_NAME
#
# Optional inputs:
#   CONTROL_PLANE_BASE_URL_INPUT
#   OPERATOR_AGENT_BASE_URL_INPUT
#
# Optional environment-backed values:
#   CONTROL_PLANE_BASE_URL
#   OPERATOR_AGENT_BASE_URL
#   STAGING_BASE_URL
#   STAGING_OPERATOR_AGENT_BASE_URL
#   PRODUCTION_BASE_URL
#   PRODUCTION_OPERATOR_AGENT_BASE_URL
#   ASYNC_VALIDATION_BASE_URL
#   ASYNC_VALIDATION_OPERATOR_AGENT_BASE_URL
#
# Output:
#   Writes the following to stdout as KEY=VALUE lines:
#     RESOLVED_CONTROL_PLANE_BASE_URL=...
#     RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE=...
#     RESOLVED_OPERATOR_AGENT_BASE_URL=...
#     RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE=...

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

is_absolute_url() {
  local value="${1:-}"
  [[ -n "$value" && "$value" =~ ^https?://[^[:space:]]+$ ]]
}

resolve_control_plane_base_url_from_environment() {
  case "$ENVIRONMENT_NAME" in
    preview)
      if is_absolute_url "${CONTROL_PLANE_BASE_URL:-}"; then
        echo "${CONTROL_PLANE_BASE_URL}|env.CONTROL_PLANE_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    staging)
      if is_absolute_url "${CONTROL_PLANE_BASE_URL:-}"; then
        echo "${CONTROL_PLANE_BASE_URL}|env.CONTROL_PLANE_BASE_URL"
      elif is_absolute_url "${STAGING_BASE_URL:-}"; then
        echo "${STAGING_BASE_URL}|env.STAGING_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    production)
      if is_absolute_url "${CONTROL_PLANE_BASE_URL:-}"; then
        echo "${CONTROL_PLANE_BASE_URL}|env.CONTROL_PLANE_BASE_URL"
      elif is_absolute_url "${PRODUCTION_BASE_URL:-}"; then
        echo "${PRODUCTION_BASE_URL}|env.PRODUCTION_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    async-validation)
      if is_absolute_url "${CONTROL_PLANE_BASE_URL:-}"; then
        echo "${CONTROL_PLANE_BASE_URL}|env.CONTROL_PLANE_BASE_URL"
      elif is_absolute_url "${ASYNC_VALIDATION_BASE_URL:-}"; then
        echo "${ASYNC_VALIDATION_BASE_URL}|env.ASYNC_VALIDATION_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    *)
      echo "|unknown-environment"
      ;;
  esac
}

resolve_operator_agent_url_from_environment() {
  case "$ENVIRONMENT_NAME" in
    preview)
      if is_absolute_url "${OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${OPERATOR_AGENT_BASE_URL}|env.OPERATOR_AGENT_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    staging)
      if is_absolute_url "${OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${OPERATOR_AGENT_BASE_URL}|env.OPERATOR_AGENT_BASE_URL"
      elif is_absolute_url "${STAGING_OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${STAGING_OPERATOR_AGENT_BASE_URL}|env.STAGING_OPERATOR_AGENT_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    production)
      if is_absolute_url "${OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${OPERATOR_AGENT_BASE_URL}|env.OPERATOR_AGENT_BASE_URL"
      elif is_absolute_url "${PRODUCTION_OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${PRODUCTION_OPERATOR_AGENT_BASE_URL}|env.PRODUCTION_OPERATOR_AGENT_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    async-validation)
      if is_absolute_url "${OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${OPERATOR_AGENT_BASE_URL}|env.OPERATOR_AGENT_BASE_URL"
      elif is_absolute_url "${ASYNC_VALIDATION_OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${ASYNC_VALIDATION_OPERATOR_AGENT_BASE_URL}|env.ASYNC_VALIDATION_OPERATOR_AGENT_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    *)
      echo "|unknown-environment"
      ;;
  esac
}

require_env ENVIRONMENT_NAME

CONTROL_PLANE_BASE_URL_INPUT="${CONTROL_PLANE_BASE_URL_INPUT:-}"
OPERATOR_AGENT_BASE_URL_INPUT="${OPERATOR_AGENT_BASE_URL_INPUT:-}"

RESOLVED_CONTROL_PLANE_BASE_URL=""
RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE="missing"

if is_absolute_url "$CONTROL_PLANE_BASE_URL_INPUT"; then
  RESOLVED_CONTROL_PLANE_BASE_URL="$CONTROL_PLANE_BASE_URL_INPUT"
  RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE="inputs.control_plane_base_url"
else
  DEPLOY_PAIR="$(resolve_control_plane_base_url_from_environment)"
  RESOLVED_CONTROL_PLANE_BASE_URL="${DEPLOY_PAIR%%|*}"
  RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE="${DEPLOY_PAIR#*|}"
fi

RESOLVED_OPERATOR_AGENT_BASE_URL=""
RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE="missing"

if is_absolute_url "$OPERATOR_AGENT_BASE_URL_INPUT"; then
  RESOLVED_OPERATOR_AGENT_BASE_URL="$OPERATOR_AGENT_BASE_URL_INPUT"
  RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE="inputs.operator_agent_base_url"
else
  OPERATOR_PAIR="$(resolve_operator_agent_url_from_environment)"
  RESOLVED_OPERATOR_AGENT_BASE_URL="${OPERATOR_PAIR%%|*}"
  RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE="${OPERATOR_PAIR#*|}"
fi

printf 'RESOLVED_CONTROL_PLANE_BASE_URL=%s\n' "$RESOLVED_CONTROL_PLANE_BASE_URL"
printf 'RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE=%s\n' "$RESOLVED_CONTROL_PLANE_BASE_URL_SOURCE"
printf 'RESOLVED_OPERATOR_AGENT_BASE_URL=%s\n' "$RESOLVED_OPERATOR_AGENT_BASE_URL"
printf 'RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE=%s\n' "$RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE"