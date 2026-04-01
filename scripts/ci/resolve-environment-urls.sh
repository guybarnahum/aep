#!/usr/bin/env bash
set -euo pipefail

# Required inputs:
#   ENVIRONMENT_NAME
#
# Optional inputs:
#   DEPLOY_URL_INPUT
#   OPERATOR_AGENT_BASE_URL_INPUT
#
# Optional environment-backed values:
#   DEPLOY_URL
#   OPERATOR_AGENT_BASE_URL
#   PREVIEW_BASE_URL
#   PREVIEW_OPERATOR_AGENT_BASE_URL
#   STAGING_BASE_URL
#   STAGING_OPERATOR_AGENT_BASE_URL
#   PRODUCTION_BASE_URL
#   PRODUCTION_OPERATOR_AGENT_BASE_URL
#   PROD_BASE_URL
#   PROD_OPERATOR_AGENT_BASE_URL
#   ASYNC_VALIDATION_BASE_URL
#   ASYNC_VALIDATION_OPERATOR_AGENT_BASE_URL
#
# Output:
#   Writes the following to stdout as KEY=VALUE lines:
#     RESOLVED_DEPLOY_URL=...
#     RESOLVED_DEPLOY_URL_SOURCE=...
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

resolve_deploy_url_from_environment() {
  case "$ENVIRONMENT_NAME" in
    preview)
      if is_absolute_url "${DEPLOY_URL:-}"; then
        echo "${DEPLOY_URL}|env.DEPLOY_URL"
      elif is_absolute_url "${PREVIEW_BASE_URL:-}"; then
        echo "${PREVIEW_BASE_URL}|env.PREVIEW_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    staging)
      if is_absolute_url "${DEPLOY_URL:-}"; then
        echo "${DEPLOY_URL}|env.DEPLOY_URL"
      elif is_absolute_url "${STAGING_BASE_URL:-}"; then
        echo "${STAGING_BASE_URL}|env.STAGING_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    production)
      if is_absolute_url "${DEPLOY_URL:-}"; then
        echo "${DEPLOY_URL}|env.DEPLOY_URL"
      elif is_absolute_url "${PRODUCTION_BASE_URL:-}"; then
        echo "${PRODUCTION_BASE_URL}|env.PRODUCTION_BASE_URL"
      elif is_absolute_url "${PROD_BASE_URL:-}"; then
        echo "${PROD_BASE_URL}|env.PROD_BASE_URL"
      else
        echo "|missing"
      fi
      ;;
    async-validation)
      if is_absolute_url "${DEPLOY_URL:-}"; then
        echo "${DEPLOY_URL}|env.DEPLOY_URL"
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
      elif is_absolute_url "${PREVIEW_OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${PREVIEW_OPERATOR_AGENT_BASE_URL}|env.PREVIEW_OPERATOR_AGENT_BASE_URL"
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
      elif is_absolute_url "${PROD_OPERATOR_AGENT_BASE_URL:-}"; then
        echo "${PROD_OPERATOR_AGENT_BASE_URL}|env.PROD_OPERATOR_AGENT_BASE_URL"
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

DEPLOY_URL_INPUT="${DEPLOY_URL_INPUT:-}"
OPERATOR_AGENT_BASE_URL_INPUT="${OPERATOR_AGENT_BASE_URL_INPUT:-}"

RESOLVED_DEPLOY_URL=""
RESOLVED_DEPLOY_URL_SOURCE="missing"

if is_absolute_url "$DEPLOY_URL_INPUT"; then
  RESOLVED_DEPLOY_URL="$DEPLOY_URL_INPUT"
  RESOLVED_DEPLOY_URL_SOURCE="inputs.deploy_url"
else
  DEPLOY_PAIR="$(resolve_deploy_url_from_environment)"
  RESOLVED_DEPLOY_URL="${DEPLOY_PAIR%%|*}"
  RESOLVED_DEPLOY_URL_SOURCE="${DEPLOY_PAIR#*|}"
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

printf 'RESOLVED_DEPLOY_URL=%s\n' "$RESOLVED_DEPLOY_URL"
printf 'RESOLVED_DEPLOY_URL_SOURCE=%s\n' "$RESOLVED_DEPLOY_URL_SOURCE"
printf 'RESOLVED_OPERATOR_AGENT_BASE_URL=%s\n' "$RESOLVED_OPERATOR_AGENT_BASE_URL"
printf 'RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE=%s\n' "$RESOLVED_OPERATOR_AGENT_BASE_URL_SOURCE"