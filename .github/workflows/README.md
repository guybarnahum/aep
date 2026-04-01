# GitHub Actions workflow architecture

This directory is structured around a clear separation between:

- **top-level entry workflows** that are triggered by GitHub events or manual dispatch
- **reusable internal workflows** that are invoked via `workflow_call`

The goal is to make deployment and validation first class, composable, and easy to extend without duplicating environment bring-up logic across multiple workflows.

## Naming convention

Top-level workflows use **hyphenated names**:

- `deploy-preview.yml`
- `deploy-staging.yml`
- `deploy-production.yml`
- `validate-async-environment.yml`

Reusable internal workflows use a leading underscore and an action-oriented name:

- `_deploy_environment.yml`
- `_validate_control_plane_smoke.yml`
- `_validate_post_deploy.yml`
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

- PR / manual environment bring-up
- fast validation of deploy correctness
- basic control-plane smoke
- lightweight post-deploy validation

This lane should stay fast and representative.

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

## Async-validation ownership

The shared `async_validation` environment must have exactly **one top-level owner**:

- `validate-async-environment.yml`

Reason:

GitHub Actions concurrency provides mutual exclusion, but not an unlimited FIFO queue. If multiple top-level workflows independently compete for the same shared environment, runs can displace each other. Centralizing ownership in a single orchestrator makes the async validation lane controlled and sequential.

As the refactor progresses, legacy top-level async validation workflows will be folded into this orchestrator as reusable workflows.

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
- future deep validation suites

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

## Stage model

The refactor is staged so the repository stays coherent and testable after each step.

### Stage A

Additive only:

- `README.md`
- `_deploy_environment.yml`
- `_validate_control_plane_smoke.yml`
- `_validate_post_deploy.yml`

No existing workflow behavior changes yet.

### Stage B

Refactor:

- `deploy-preview.yml`
- `deploy-staging.yml`

to call the new reusable building blocks.

### Stage C

Add:

- `deploy-production.yml`

### Stage D

Convert legacy async validation workflows into reusable workflows:

- `_validate_operator_surface.yml`
- `_validate_operator_governance.yml`
- `_validate_paperclip_handoff.yml`

### Stage E

Add the single async validation orchestrator:

- `validate-async-environment.yml`

### Stage F

Remove legacy top-level async validation entrypoints and finalize docs.

## Design rules

1. **Deploy once, validate many times**  
   Environment bring-up should be shared and reusable.

2. **Validation suites should be scenario-oriented**  
   Surface, governance, and handoff each deserve their own suite.

3. **Top-level workflows should represent lanes, not individual checks**  
   Preview, staging, production, and async validation are lanes.

4. **Summaries should be first class**  
   Every reusable workflow should emit a clear summary and machine-usable outputs.

5. **Warnings and skips should be visible but distinct from hard failures**  
   Blocking failure, advisory warning, skipped-by-config, and infra degradation should remain distinguishable.
