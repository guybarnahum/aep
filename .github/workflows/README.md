# GitHub Actions workflow architecture

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
- resource cleanup is handled by `free-leaked-resources.yml` (was `reap-preview-garbage.yml`)

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
- `_validate_control_plane_smoke.yml`
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
- basic control-plane smoke
- lightweight post-deploy validation

Preview is dynamic:

- preview is PR-scoped and ephemeral
- preview deploy uses Worker and D1 names derived from the PR number
- the deploy URL is produced by the preview deploy workflow outputs
- preview should not rely on `PREVIEW_BASE_URL`
- preview is destroyed on PR close by `destroy-preview.yml`
- orphaned leftovers are cleaned conservatively by `reap-preview-garbage.yml`

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
- control-plane smoke
- lightweight post-deploy validation

This lane should stay stricter than preview, but still avoid deep long-running scenario suites.

### Production

`deploy-production.yml`

Purpose:

- production deployment lane
- narrowest and strictest validation
- strict health/version verification
- minimal smoke
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
3. environment secrets fallback
4. fail or skip with summary guidance

Preview is the exception to the long-lived environment-backed fallback model:

- preview receives its deploy URL dynamically from `_deploy_preview_environment.yml` outputs
- long-lived lanes such as staging, production, and async-validation can still resolve via environment vars/secrets
- preview lifecycle is split across bring-up in `deploy-preview.yml`, primary teardown in `destroy-preview.yml`, and conservative backstop cleanup in `reap-preview-garbage.yml`

This is the preferred GitHub Actions pattern for this repo. Direct caller-side secret passing for deploy URLs is no longer the preferred model.

## Async-validation ownership

The shared `async_validation` environment has two canonical top-level lanes:

- `validate-async-environment.yml` for `_validate_operator_surface.yml`, `_validate_operator_governance.yml`, and `_validate_paperclip_handoff.yml`
- `validate-async-deep.yml` for `_validate_async_orchestration.yml`, `_validate_escalation_integrity.yml`, and `_validate_multi_worker_safety.yml`

Each top-level workflow owns a coherent family of reusable async validation suites.

## Reusable building blocks

### `_deploy_environment.yml`

Shared environment bring-up primitive.

Responsibilities:

- checkout
- Node setup
- `npm ci`
- build metadata generation
- build
- deploy control-plane
- optional operator-agent deploy
- D1 migrations
- readiness wait
- health check
- outputs for downstream validation

This workflow must not include domain-specific validation scenarios.

### `_validate_control_plane_smoke.yml`

Reusable blocking smoke scenario.

Responsibilities:

- run the minimal control-plane workflow start / poll-to-completion scenario
- emit a clear pass/fail summary
- provide a stable contract for preview, staging, and production deploy lanes

This workflow must not deploy anything.

### `_validate_post_deploy.yml`

Reusable lightweight post-deploy validation suite.

Responsibilities:

- run lightweight validation suitable for preview/staging/production
- emit `enabled`, `outcome`, and `attention` outputs
- summarize warnings, skips, and failures clearly

This workflow must stay lightweight. It must not absorb deeper governance or handoff scenario suites.

### `_validate_operator_surface.yml`

Reusable async-validation scenario suite for operator surface behavior.

Typical scope:

- operator-facing contract
- scheduled routing
- operator surface checks
- org schema seed validation
- org inventory route validation

### `_validate_operator_governance.yml`

Reusable async-validation scenario suite for governance semantics.

Typical scope:

- manager advisory
- manager policy overlay
- escalation audit
- escalation lifecycle
- approval state machine

### `_validate_paperclip_handoff.yml`

Reusable async-validation scenario suite for Paperclip company-origin handoff semantics.

Typical scope:

- company provenance propagation
- handoff integrity
- scheduler ownership correctness
- approval-gated first handoff

### `_validate_async_orchestration.yml`

Reusable async-validation scenario suite for orchestration state machine behavior.

Typical scope:

- callback idempotency
- retry and timeout policy
- terminal failure propagation
- teardown failure handling

### `_validate_escalation_integrity.yml`

Reusable async-validation scenario suite for escalation invariants that depend on the deployed operator-agent.

Typical scope:

- escalation lifecycle
- escalation audit integrity
- manager advisory provenance
- operator-agent readiness-gated escalation checks

### `_validate_multi_worker_safety.yml`

Reusable async-validation scenario suite for cross-worker governance and safety behavior.

Typical scope:

- multi-worker department safety
- agent timeout recovery
- approval-gated cross-worker coordination
- unsafe state drift prevention

## Validation grouping

### Preview deploy lane

Should include:

- build/test gate
- deploy
- readiness
- health
- control-plane smoke
- lightweight post-deploy validation

### Staging deploy lane

Should include:

- build/test gate
- deploy
- readiness
- health
- control-plane smoke
- lightweight post-deploy validation

Should remain representative but not deep/slow.

### Production deploy lane

Should include:

- deploy
- readiness
- strict health/version verification
- minimal smoke
- lightweight post-deploy validation

Should be the narrowest lane.

### Async validation lane

Should include:

- operator surface suite
- operator governance suite
- Paperclip handoff suite
- lightweight async-validation suites tied to operator-facing contracts
- org catalog schema and inventory validation tied to the shared async_validation environment

### Async deep validation lane

Should include:

- async orchestration suite
- escalation integrity suite
- multi-worker safety suite
- future deep validation suites

### Resource cleanup lane

`free-leaked-resources.yml`

Should include:
- scheduled and manual cleanup of all ephemeral and test resources (preview, sample-worker-run_ workers, etc.)
- global to the Cloudflare account, not environment-specific

## How to extend

When adding a new validation:

### Add a new reusable workflow if the suite has its own identity

Create a new `_validate_*.yml` when the checks:

- validate a coherent domain
- have their own runtime budget
- have distinct failure triage
- are likely to grow independently

Examples:

- `_validate_retry_timeout_semantics.yml`
- `_validate_resilience.yml`
- `_validate_audit_provenance.yml`

### Keep a check in an existing suite when it clearly belongs there

Examples:

- approval-transition behavior belongs in `_validate_operator_governance.yml`
- operator response-shape checks belong in `_validate_operator_surface.yml`
- company-origin provenance checks belong in `_validate_paperclip_handoff.yml`

### Keep deploy lanes fast

Do not add deeper mutation-heavy or long-running suites directly to preview, staging, or production unless they are explicitly lightweight and deploy-lane safe.

### Keep async suites reusable

New deeper suites should become new `_validate_*` reusable workflows and be called from the appropriate async lane, usually `validate-async-deep.yml` for orchestration-heavy suites and `validate-async-environment.yml` for operator-facing suites.

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
├── _validate_control_plane_smoke.yml
├── _validate_post_deploy.yml
├── _validate_async_orchestration.yml
├── _validate_escalation_integrity.yml
├── _validate_multi_worker_safety.yml
├── _validate_operator_surface.yml
├── _validate_operator_governance.yml
└── _validate_paperclip_handoff.yml
```
```

## Design rules

1. **Deploy once, validate many times**
   Environment bring-up should be shared and reusable.

2. **Validation suites should be scenario-oriented**
   Surface, governance, and handoff each deserve their own suite.

3. **Top-level workflows should represent lanes, not individual checks**
   Preview, staging, production, async validation, and async deep validation are lanes.

Preview is not a long-lived environment-backed lane like staging or production; its lifecycle is split across bring-up, primary teardown, and conservative backstop cleanup workflows.

4. **Summaries should be first class**
   Every reusable workflow should emit a clear summary and machine-usable outputs.

5. **Warnings and skips should be visible but distinct from hard failures**
   Blocking failure, advisory warning, skipped-by-config, and infra degradation should remain distinguishable.

## Note on failures after workflow cleanup

At this point, workflow failures are expected to surface real product or data-contract invariants rather than CI architecture issues.

Example:

- expired approvals must include `expiresAt`

That kind of failure should now be treated as a system contract issue, not a workflow wiring issue.

5. **Warnings and skips should be visible but distinct from hard failures**  
   Blocking failure, advisory warning, skipped-by-config, and infra degradation should remain distinguishable.
