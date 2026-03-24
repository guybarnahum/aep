#!/usr/bin/env bash
set -euo pipefail

REGION="${1:-us-west-2}"
REPO_SLUG="${REPO_SLUG:-guybarnahum/aep}"

GHA_ROLE_NAME="${GHA_ROLE_NAME:-aep-github-actions-role}"
LAMBDA_ROLE_NAME="${LAMBDA_ROLE_NAME:-aep-lambda-exec-role}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd aws
need_cmd jq

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"

OIDC_PROVIDER_HOST="token.actions.githubusercontent.com"
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER_HOST}"

GHA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${GHA_ROLE_NAME}"
LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${LAMBDA_ROLE_NAME}"

echo "AWS account:      ${ACCOUNT_ID}"
echo "Caller ARN:       ${CALLER_ARN}"
echo "Region:           ${REGION}"
echo "Repo slug:        ${REPO_SLUG}"
echo "GHA role:         ${GHA_ROLE_NAME}"
echo "Lambda role:      ${LAMBDA_ROLE_NAME}"
echo

create_oidc_provider_if_needed() {
  echo "==> Ensuring GitHub OIDC provider exists"

  if aws iam get-open-id-connect-provider \
      --open-id-connect-provider-arn "${OIDC_PROVIDER_ARN}" >/dev/null 2>&1; then
    echo "OIDC provider already exists: ${OIDC_PROVIDER_ARN}"
    return
  fi

  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_PROVIDER_HOST}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" >/dev/null

  echo "Created OIDC provider: ${OIDC_PROVIDER_ARN}"
}

write_lambda_trust_policy() {
  cat > "${TMP_DIR}/lambda-trust-policy.json" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON
}

write_github_trust_policy() {
  cat > "${TMP_DIR}/github-trust-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_PROVIDER_HOST}:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "${OIDC_PROVIDER_HOST}:sub": "repo:${REPO_SLUG}:*"
        }
      }
    }
  ]
}
JSON
}

write_github_actions_policy() {
  cat > "${TMP_DIR}/github-actions-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaCrudForAep",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:CreateFunctionUrlConfig",
        "lambda:GetFunctionUrlConfig",
        "lambda:DeleteFunctionUrlConfig",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:TagResource",
        "lambda:UntagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassExecutionRole",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "${LAMBDA_ROLE_ARN}"
    }
  ]
}
JSON
}

create_or_update_lambda_role() {
  echo "==> Ensuring Lambda execution role exists"

  write_lambda_trust_policy

  if aws iam get-role --role-name "${LAMBDA_ROLE_NAME}" >/dev/null 2>&1; then
    echo "Lambda role already exists: ${LAMBDA_ROLE_ARN}"
  else
    aws iam create-role \
      --role-name "${LAMBDA_ROLE_NAME}" \
      --assume-role-policy-document "file://${TMP_DIR}/lambda-trust-policy.json" >/dev/null
    echo "Created Lambda role: ${LAMBDA_ROLE_ARN}"
  fi

  aws iam attach-role-policy \
    --role-name "${LAMBDA_ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" >/dev/null || true

  echo "Attached AWSLambdaBasicExecutionRole to ${LAMBDA_ROLE_NAME}"
}

create_or_update_github_actions_role() {
  echo "==> Ensuring GitHub Actions OIDC role exists"

  write_github_trust_policy
  write_github_actions_policy

  if aws iam get-role --role-name "${GHA_ROLE_NAME}" >/dev/null 2>&1; then
    echo "GitHub Actions role already exists: ${GHA_ROLE_ARN}"

    aws iam update-assume-role-policy \
      --role-name "${GHA_ROLE_NAME}" \
      --policy-document "file://${TMP_DIR}/github-trust-policy.json" >/dev/null

    echo "Updated trust policy for ${GHA_ROLE_NAME}"
  else
    aws iam create-role \
      --role-name "${GHA_ROLE_NAME}" \
      --assume-role-policy-document "file://${TMP_DIR}/github-trust-policy.json" >/dev/null
    echo "Created GitHub Actions role: ${GHA_ROLE_ARN}"
  fi

  aws iam put-role-policy \
    --role-name "${GHA_ROLE_NAME}" \
    --policy-name "aep-github-actions-inline-policy" \
    --policy-document "file://${TMP_DIR}/github-actions-policy.json" >/dev/null

  echo "Applied inline policy to ${GHA_ROLE_NAME}"
}

print_outputs() {
  echo
  echo "==> Done"
  echo
  echo "Add these GitHub Actions secrets:"
  echo
  echo "AWS_REGION=${REGION}"
  echo "AWS_LAMBDA_EXECUTION_ROLE_ARN=${LAMBDA_ROLE_ARN}"
  echo "AWS_GITHUB_ACTIONS_ROLE_ARN=${GHA_ROLE_ARN}"
  echo
  echo "Workflow reminder:"
  echo "  permissions:"
  echo "    id-token: write"
  echo "    contents: read"
  echo
  echo "Optional local exports:"
  echo "  export AWS_REGION=${REGION}"
  echo "  export AWS_LAMBDA_EXECUTION_ROLE_ARN=${LAMBDA_ROLE_ARN}"
}

create_oidc_provider_if_needed
create_or_update_lambda_role
create_or_update_github_actions_role
print_outputs
