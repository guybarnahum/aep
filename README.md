# AEP — Agentic Engineering Platform

A control plane for autonomous software systems.

This repository is structured to let the MVP grow into the full AEP platform without reorganizing the repo later.

---

# 🚀 Current Status (Commit 3 — Complete)

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

### Planned

- AWS
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
- callback token (hashed)
- lifecycle timestamps

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

- CI does not yet validate full async orchestration (sync-only today)
- job retries / idempotency not yet implemented
- partial failure recovery paths need deeper validation
- provider coverage limited to Cloudflare

---

# 🔜 Next Steps (Commit 4)

1. async orchestration validation in CI
2. job retry + idempotency model
3. failure-path hardening
4. additional providers (AWS, GCP)
5. improved operator UI / dashboards
6. optional workflow engine refactor (per-step handlers)

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