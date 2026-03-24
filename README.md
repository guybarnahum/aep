# AEP — Agentic Engineering Platform

A control plane for autonomous software systems.

This repository is structured to let the MVP grow into the full AEP platform without reorganizing the repo later.

## At a glance

- Control plane runs on Cloudflare Workers + Durable Objects.
- Infrastructure execution is externalized to Node runners.
- Workflows support sync and async execution modes.
- Async mode supports dispatch, callback, and resume.
- Observability is trace-first with explicit lifecycle events.

## Quick Navigation

- [Architecture Overview](#-architecture-overview)
- [Workflow Model](#-workflow-model)
- [External Job Model](#-external-job-model)
- [Observability](#-observability)
- [CI / Deployment Flow](#-ci--deployment-flow)
- [Async Orchestration Validation Matrix](#-async-orchestration-validation-a1-a4-b1-b5)
- [Local Development](#-local-development)
- [Known Limitations](#️-known-limitations)
- [Next Steps](#-next-steps)

---

# 🚀 Current Status (Commit 5 — AWS minimal provider)

AEP now supports **fully externalized infrastructure execution** with a clean separation between:

- **Control plane (Worker / Durable Objects)** — orchestration only
- **Execution layer (Node / CI / runners)** — real infrastructure actions

This is the first milestone where:

> orchestration, execution, and observability are cleanly separated and fully functional end-to-end.

---

# 🧱 Architecture Overview

## Control Plane (Cloudflare Workers)

- API:
  - `/workflow/start`
  - `/workflow/:id`
  - `/trace/:id`
- Durable Object:
  - workflow orchestration engine
- D1:
  - persistent state (runs, steps, deployments, jobs, events)

### Responsibilities

- workflow state machine
- step execution and transitions
- emitting structured trace events
- dispatching external jobs
- resuming workflows after callbacks

---

## Execution Layer (Node Runtime)

- `scripts/deploy/run-node-deploy.ts`
- `scripts/deploy/run-node-teardown.ts`

### Responsibilities

- perform real infrastructure operations
- call provider adapters
- report lifecycle via callback:
  - `running`
  - `succeeded`
  - `failed`

---

## Provider Plugins

Located under:

```text
services/deployment-engine/src/providers/
```

### Current

- ✅ Cloudflare (wrangler-based)
- ✅ AWS (minimal Lambda Function URL adapter)

### Planned

- GCP

### Design Principle

> No provider-specific logic exists in the control plane.

---

# 🔄 Workflow Model

## Steps

```text
INIT
→ CREATE_ENV
→ DEPLOY
→ HEALTH_CHECK
→ SMOKE_TEST
→ TEARDOWN
→ CLEANUP_AUDIT
→ COMPLETE
```

---

## Execution Modes

### Sync Mode (CI / smoke)

- execution happens inside the workflow engine
- no external jobs
- deterministic and fast

Used in:
- staging deploy validation
- smoke tests

---

### Async Mode (real system behavior)

```text
STEP (DEPLOY / TEARDOWN)
→ deploy_job.created
→ *.job_dispatched
→ step = waiting
→ external runner executes
→ callback (running → succeeded/failed)
→ workflow resumes
```

Supports:
- multiple pauses per workflow
- full external execution lifecycle

### Mode comparison

| Mode | Runtime behavior | Best for |
| --- | --- | --- |
| `sync` | Executes directly in workflow engine | CI smoke checks, deterministic validation |
| `async` | Dispatches external jobs and waits for callback | Real orchestration and provider execution |

---

# 🔁 External Job Model

Stored in `deploy_jobs`:

### Status lifecycle

```text
queued → running → succeeded / failed
```

### Each job includes

- provider
- request payload
- status and lifecycle timestamps

### Each attempt includes

- callback token (hashed)
- status and lifecycle timestamps

### Logical jobs vs execution attempts

AEP distinguishes between:

- **logical job** - the workflow-level external operation (`DEPLOY` or `TEARDOWN`)
- **execution attempt** - one concrete dispatch of that logical job

Each attempt has its own callback token and lifecycle state.

This allows the control plane to safely handle:

- duplicate callbacks
- out-of-order callbacks
- stale callbacks from non-active attempts

Only the active attempt for a logical job may mutate workflow state.
Duplicate or stale callbacks are treated as no-op acknowledgements.

## Retry and timeout model (Commit 4 Stage 2B)

AEP logical jobs may span multiple execution attempts.

Current policy:

- retryable failures create a new active attempt up to `max_attempts`
- non-retryable failures fail the logical job immediately
- timed-out attempts may be advanced explicitly in dev/test
- workflow steps remain `waiting` until the logical job is terminal

This keeps retry behavior internal to the control plane while preserving
clear trace visibility across attempts.

## Provider contract

AEP separates orchestration from execution.

### Control-plane responsibilities

- manages logical jobs and attempts
- handles callbacks
- enforces retry and timeout policy
- stores opaque request/result payloads

### Provider responsibilities

- execute deploy / teardown
- send lifecycle callbacks (`running`, `succeeded`, `failed`)
- return provider-specific result data

### Contract

Deploy result:
- `deployment_ref` (required)
- `preview_url` (optional)

Teardown result:
- `deployment_ref`
- `status: destroyed`

### Provider isolation

The control-plane does not depend on any specific provider.

All provider-specific logic lives in:
- deploy/teardown runners
- future deployment-engine adapters

### Current AWS scope

The AWS provider is intentionally minimal in Commit 5:

- deploys a small AWS Lambda
- exposes it via Lambda Function URL
- returns:
  - `deployment_ref`
  - `preview_url`
- teardown deletes the Lambda resource

Current AWS adapter assumptions:
- AWS credentials are supplied externally
- execution role ARN is supplied externally
- no CloudFormation / CDK / API Gateway layer yet

---

## Job Lifecycle Events (trace)

### Deploy

- `deploy.job_dispatched`
- `deploy.job_started`
- `deploy.job_succeeded`
- `deploy.job_failed`

### Teardown

- `teardown.job_dispatched`
- `teardown.job_started`
- `teardown.job_succeeded`
- `teardown.job_failed`

---

# 🔍 Observability

## Trace API

```bash
GET /trace/:id
```

Returns ordered workflow events:

```json
{
  "event_type": "deploy.job_succeeded",
  "timestamp": "...",
  "payload": {
    "job_id": "job_123",
    "provider": "cloudflare"
  }
}
```

### Key improvements (Stage 4A)

- normalized `payload` (no raw `payload_json`)
- explicit job lifecycle events
- full correlation across workflow + jobs

---

# 🧪 CI / Deployment Flow

## Staging Deploy (GitHub Actions)

```text
npm test
→ generate build metadata
→ wrangler deploy
→ D1 migrations
→ wait for /healthz
→ health check (SHA validation)
→ smoke test (sync teardown)
```

### Smoke test payload

```json
{
  "teardown_mode": "sync"
}
```

### Why sync in CI

- deterministic
- fast
- no dependency on async runners

---

## Summary Reporting

GitHub Actions summary now reports **per-step outcome**:

- Worker deploy
- D1 migrations
- readiness
- health check
- smoke test

Failures (e.g. SHA mismatch) are explicitly surfaced.

---

# 📐 Async orchestration validation (A1-A4, B1-B5)

<details>
<summary><strong>Expand scenario matrix and operator guidance</strong></summary>

## Async orchestration validation (A1-A4, B1-B5)

AEP validates its async orchestration model through a deterministic CI scenario matrix.

These scenarios are executed in `Validate Async Orchestration` and are the primary contract for correctness of:

- attempt model
- callback idempotency
- retry semantics
- timeout handling
- teardown and cleanup behavior

---

## Stage 2A - Attempt model and callback idempotency

These scenarios validate correctness of the logical job + attempt model and ensure callback handling is safe under real-world conditions.

### A1 - Happy path

Flow:
- deploy succeeds
- health + smoke checks pass
- teardown succeeds
- workflow completes

Proves:
- end-to-end async orchestration works
- deploy and teardown lifecycle is correct
- trace and workflow state align

---

### A2 - Duplicate terminal callback

Flow:
- a `succeeded` callback is replayed for the same attempt

Proves:
- terminal callbacks are idempotent
- duplicate delivery (real-world condition) does not corrupt state

---

### A3 - Regressive callback

Flow:
- a `running` callback is sent after a `succeeded` callback

Proves:
- invalid state regression is rejected
- attempt state is monotonic

---

### A4 - Stale attempt callback

Flow:
- attempt 1 is superseded by attempt 2
- callback for attempt 1 is replayed

Proves:
- only the active attempt can mutate logical job state
- stale callbacks are ignored safely

---

## Stage 2B - Retry and timeout policy

These scenarios validate operational behavior of async orchestration under failure.

---

### B1 - Retryable failure then success

Flow:
- attempt 1 fails with `retryable=true`
- attempt 2 is created
- attempt 2 succeeds

Proves:
- retry scheduling works
- workflow remains `waiting` during retries
- recovery via retry is correct

---

### B2 - Non-retryable failure

Flow:
- attempt fails with `retryable=false`

Proves:
- logical job fails immediately
- workflow step fails
- workflow run transitions to `failed`

---

### B3 - Retry exhaustion

Flow:
- attempts fail with `retryable=true` up to `max_attempts`
- no further attempts are created

Proves:
- retry budget is enforced
- logical job transitions to terminal `failed`
- workflow run terminates cleanly (no stuck `running` state)

---

### B4 - Timeout then retry

Flow:
- attempt enters `running` but never completes
- timeout advancement is triggered
- new attempt is created
- new attempt succeeds

Proves:
- timeout handling is explicit and recoverable
- stale callbacks from timed-out attempts are ignored
- retry after timeout behaves like normal retry

---

### B5 - Teardown non-retryable failure

Flow:
- deploy succeeds
- teardown attempt fails with `retryable=false`
- workflow run fails

Proves:
- teardown failures are treated as terminal
- workflow failure is attributed to teardown step
- system explicitly signals that cleanup may be incomplete

---

## Operator model

When a workflow fails, the expected diagnosis flow is:

1. Check workflow run status:
  - `completed` vs `failed`
2. Identify failing step:
  - `DEPLOY`, `TEARDOWN`, `CLEANUP_AUDIT`, etc.
3. Inspect trace (`/trace/:id`):
  - locate latest logical job event
  - locate latest attempt event
  - check:
    - `failure_kind`
    - `retryable`
    - `attempt_no` vs `max_attempts`
    - timeout vs callback failure
4. Interpret failure mode.

| Failure type | Meaning | Action |
| --- | --- | --- |
| retryable failure | transient issue | system will retry |
| retry exhausted | persistent failure | inspect provider or config |
| non-retryable failure | hard failure | fix input/config |
| timeout | missing callback | inspect external runner |
| teardown failure | cleanup incomplete | verify environment state |

---

## Current operational guarantees

- callbacks are idempotent and safe to replay
- stale attempts cannot corrupt state
- retry policy is bounded and explicit
- timeout recovery is supported
- no workflow remains indefinitely in an ambiguous `running` state
- teardown failures are explicit and visible

---

## Current limitations

- timeout advancement is explicitly triggered (no background scheduler yet)
- retry policy is simple (fixed delays, bounded attempts)
- provider support is currently Cloudflare-first
- AWS provider validation currently covers:
  - A1 happy path
  - B2 non-retryable deploy failure
  - B5 teardown non-retryable failure

---

## Summary

The A1-A4 and B1-B5 scenarios together define the correctness contract for AEP async orchestration.

Any change to:
- control-plane
- workflow-engine
- provider adapters

must preserve these guarantees and keep all scenarios passing.

</details>

---

# 🧪 Local Development

## 1. Apply D1 migrations

```bash
npx wrangler d1 migrations apply aep-db \
  --local \
  --cwd core/control-plane \
  --config wrangler.toml
```

---

## 2. Run control plane

```bash
npm run dev:control-plane
```

---

## 3. Sync workflow (CI-style)

```bash
curl -X POST http://127.0.0.1:8787/workflow/start \
  -H 'content-type: application/json' \
  -d '{
    "tenant_id": "t_demo",
    "project_id": "p_demo",
    "repo_url": "https://github.com/example/repo",
    "branch": "main",
    "service_name": "sample-worker",
    "teardown_mode": "sync"
  }'
```

---

## 4. Full async orchestration (recommended)

Use:

```bash
npx tsx scripts/ci/async-deploy-check.ts \
  --base-url http://127.0.0.1:8787 \
  --provider cloudflare \
  --service-name sample-worker
```

### This validates:

- async deploy dispatch
- real deploy execution
- callback + resume
- health + smoke
- async teardown dispatch
- real teardown execution
- final cleanup + completion

---

# 📁 Repository Layout

```text
.
├── apps/                     # future UI / operator surfaces
├── core/
│   ├── control-plane/       # API + DO + orchestration
│   ├── workflow-engine/     # workflow state machine
│   └── types/               # shared env/types
├── services/
│   └── deployment-engine/   # provider adapters
├── infra/
│   └── cloudflare/          # wrangler + D1 migrations
├── scripts/
│   ├── ci/                  # CI validation scripts
│   └── deploy/              # node runners
└── packages/
    └── event-schema/        # shared schema contracts
```

---

# ⚠️ Known Limitations

- AWS provider is minimal: validates A1 (happy path), B2 (non-retryable deploy failure), B5 (teardown non-retryable failure)
- Cloudflare remains the full validation matrix provider (A1–A4, B1–B5)
- no scheduler yet (retry scheduling is manual / CI-driven)
- no operator UI yet
- no multi-tenant model yet
- partial failure recovery paths need deeper validation

---

# 🔜 Next Steps

1. expand AWS validation matrix (A2–A4, B1, B3, B4)
2. GCP provider (stub → real)
3. failure-path hardening and retry scheduling
4. improved operator UI / dashboards
5. optional workflow engine refactor (per-step handlers)

---

# 🎯 MVP Definition (updated)

AEP is functional when:

- a repo can be deployed as a preview environment
- health + smoke checks succeed
- workflow execution is fully observable via trace
- environment is fully torn down
- cleanup audit proves no resources remain
- execution is externalized and resumable

---

# 🧠 Design Principles

- control plane is orchestration only
- execution is externalized
- workflows are resumable and observable
- provider logic is pluggable
- CI remains deterministic and minimal

---

# 🧪 Validation Status

- ✅ full local async orchestration (deploy + teardown)
- ✅ real Cloudflare deploy + teardown
- ✅ callback + resume (multi-step)
- ✅ trace observability with lifecycle events
- ✅ staging deploy + smoke test passing

---

# 📌 One-line summary

AEP is now a working control plane for autonomous software systems with fully externalized infrastructure execution, async orchestration, and first-class observability.