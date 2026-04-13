# GitHub Actions workflow architecture

## CI as a system layer

CI is not just automation.

It is the **validation system of the organization**, responsible for:

- enforcing contracts
- validating structure
- validating policy
- validating execution correctness

The layered workflow architecture reflects this role.

This directory is structured around a clear separation between:

- **top-level entry workflows** that are triggered by GitHub events or manual dispatch
- **reusable internal workflows** that are invoked via `workflow_call`

Resource cleanup is handled globally by `free-leaked-resources.yml`, which reaps all ephemeral and test resources (including preview and sample-worker-run_ workers) across the account, not just preview.

Post-deploy validation is robust and durable, using direct invocation and internal service bindings for all deploy lanes.

The goal is to make deployment and validation first class, composable, and easy to extend without duplicating environment bring-up logic across multiple workflows.

Current state:

- preview deploy is PR-only and ephemeral
- preview teardown is split across PR-close destroy and scheduled backstop reaping
- async-validation now verifies both org schema seed state and org inventory route availability
- post-deploy validation is unified and robust for preview, staging, and production (using internal service bindings)
- resource cleanup is handled by `free-leaked-resources.yml` (was `free-leaked-resources.yml`)

## Naming convention

Top-level workflows use **hyphenated names**:

- `deploy-preview.yml`
- `destroy-preview.yml`
- `free-leaked-resources.yml`
- `deploy-staging.yml`
- `deploy-production.yml`
- `validate-async-environment.yml`
- `validate-async-deep.yml`

Reusable internal workflows use a leading underscore and an action-oriented name:

- `_deploy_environment.yml`
- `_deploy_preview_environment.yml`
- `_validate_environment_layer.yml`
- `_validate_schema_layer.yml`
- `_validate_contracts_layer.yml`
- `_validate_policy_layer.yml`
- `_validate_post_deploy.yml`
- `_validate_async_orchestration.yml`
- `_validate_escalation_integrity.yml`
- `_validate_multi_worker_safety.yml`
- `_validate_operator_surface.yml`
- `_validate_operator_governance.yml`
- `_validate_paperclip_handoff.yml`

Rule of thumb:

- **no leading underscore** = directly triggerable entry workflow
- **leading underscore** = reusable building block only

## Workflow lanes

### Preview

`deploy-preview.yml`

Purpose:

- PR environment bring-up
- PR-scoped ephemeral preview environment creation
- fast validation of deploy correctness
- basic control-plane validation
- lightweight post-deploy validation

Preview is dynamic:

- preview is PR-scoped and ephemeral
- preview deploy uses Worker and D1 names derived from the PR number
- the deploy URL is produced by the preview deploy workflow outputs
- preview should not rely on `PREVIEW_BASE_URL`
- preview is destroyed on PR close by `destroy-preview.yml`
- orphaned leftovers are cleaned conservatively by `free-leaked-resources.yml`

This lane should stay fast and representative.

### Preview lifecycle

- PR opens or updates: deploy or update the preview environment
- preview validations run against the emitted deploy URL
- PR closes: destroy the preview environment via `destroy-preview.yml`
- scheduled or manual reaper runs: clean up orphaned preview resources missed by the primary teardown path

### Staging

`deploy-staging.yml`

Purpose:

- mainline deployment lane
- representative system validation
- deploy correctness
- environment-layer validation (readiness, health)
- lightweight post-deploy validation

This lane should stay stricter than preview, but still avoid deep long-running scenario suites.

### Production

`deploy-production.yml`

Purpose:

- production deployment lane
- narrowest and strictest validation
- strict health/version verification
- minimal validation
- lightweight post-deploy checks only

This lane should avoid deep mutation-heavy validation.

### Async validation

`validate-async-environment.yml`

Purpose:

- deeper, longer-running scenario validation against the shared `async_validation` environment
- operator surface validation
- operator governance validation
- Paperclip handoff validation
- future resilience / timeout / retry / soak suites

This is the right place for deeper stateful validation.

### Async deep validation

`validate-async-deep.yml`

Purpose:

- deeper, longer-running scenario validation against the shared `async_validation` environment
- async orchestration validation
- escalation integrity validation
- multi-worker safety validation
- future resilience / timeout / retry / soak suites that need their own deep lane

This is the right place for deep orchestration and cross-worker stateful validation.

## Canonical environment resolution model

The canonical model for deploy and validation workflows is:

- top-level workflows pass `environment_name`
- callers use `secrets: inherit`
- reusable workflows bind to `environment: ${{ inputs.environment_name }}`
- reusable workflows resolve URLs internally

URL resolution order inside reusable workflows is:

1. explicit input if supplied
2. environment vars such as `vars.CONTROL_PLANE_BASE_URL` and `vars.OPERATOR_AGENT_BASE_URL`
3. fail or skip with summary guidance

Legacy secret-based fallback is no longer part of the canonical model.

## CI.9 URL contract (locked)

The canonical contract for all deploy and validation workflows is:

- `CONTROL_PLANE_BASE_URL`
- `OPERATOR_AGENT_BASE_URL`

These must be passed explicitly by top-level workflows when available.

Reusable workflows must:

- prefer explicit inputs over environment variables
- never depend on implicit or legacy secret-based URL injection

Preview is the exception to the long-lived environment-backed fallback model:

- preview receives its deploy URL dynamically from `_deploy_preview_environment.yml` outputs
- long-lived lanes such as staging, production, and async-validation can still resolve via environment vars
- preview lifecycle is split across bring-up, primary teardown, and conservative backstop cleanup workflows

## Async-validation ownership

The shared `async_validation` environment has two canonical top-level lanes:

- `validate-async-environment.yml`
- `validate-async-deep.yml`

Each top-level workflow owns a coherent family of reusable async validation suites.

## Reusable building blocks

## Layered validation model (CI.9)

Validation is now organized around reusable workflow layers:

- environment
- schema
- contracts
- policy
- scenarios

Top-level workflows compose these layers into deploy-and-validate lanes.

### `_deploy_environment.yml`

Shared environment bring-up primitive.

### `_validate_control_plane_smoke.yml` (DEPRECATED)

⚠️ This workflow has been removed in CI.9.

Control-plane validation is now handled within the environment layer and post-deploy validation.

### `_validate_post_deploy.yml`

Reusable lightweight post-deploy validation suite.

### `_validate_operator_surface.yml`

Reusable async-validation scenario suite for operator surface behavior.

### `_validate_operator_governance.yml`

Reusable async-validation scenario suite for governance semantics.

### `_validate_paperclip_handoff.yml`

Reusable async-validation scenario suite for Paperclip handoff semantics.

### `_validate_async_orchestration.yml`

Reusable async-validation scenario suite for orchestration behavior.

### `_validate_escalation_integrity.yml`

Reusable async-validation scenario suite for escalation invariants.

### `_validate_multi_worker_safety.yml`

Reusable async-validation scenario suite for cross-worker safety behavior.

## Validation grouping

### Preview deploy lane

- build/test
- deploy
- readiness
- health
- environment-layer validation (readiness, health)
- lightweight post-deploy validation

### Staging deploy lane

- build/test
- deploy
- readiness
- health
- environment-layer validation (readiness, health)
- lightweight post-deploy validation

### Production deploy lane

- deploy
- readiness
- strict health/version verification
- minimal validation
- lightweight post-deploy validation

## Core steady-state workflow set

```text
.github/workflows/
├── README.md
├── deploy-preview.yml
├── destroy-preview.yml
├── free-leaked-resources.yml
├── deploy-staging.yml
├── deploy-production.yml
├── validate-async-environment.yml
├── validate-async-deep.yml
├── _deploy_environment.yml
├── _deploy_preview_environment.yml
├── _validate_environment_layer.yml
├── _validate_schema_layer.yml
├── _validate_contracts_layer.yml
├── _validate_policy_layer.yml
├── _validate_post_deploy.yml
├── _validate_async_orchestration.yml
├── _validate_escalation_integrity.yml
├── _validate_multi_worker_safety.yml
├── _validate_operator_surface.yml
├── _validate_operator_governance.yml
└── _validate_paperclip_handoff.yml
```

## Design rules

1. **Deploy once, validate many times**
2. **Validation suites should be scenario-oriented**
3. **Top-level workflows represent lanes**
4. **Summaries are first-class**
5. **Warnings and skips are distinct**

6. **No flat CI script entrypoints**

Validation scripts must not be referenced via:

scripts/ci/<file>.ts

All validation must use:

scripts/ci/checks/<layer>/