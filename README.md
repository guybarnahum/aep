# AEP — Agentic Engineering Platform

A control plane for autonomous software systems.

This repository is structured to let the MVP grow into the full AEP platform without reorganizing the repo later.

---

# 🚀 Current Status (Commit 3)

The system now supports:

- full **control-plane orchestration** via Cloudflare Workers + Durable Objects
- real **node-side deployment + teardown execution**
- **provider-aware architecture** (Cloudflare implemented, AWS/GCP ready)
- **async job model** for infrastructure operations (teardown complete, deploy next)
- **sync mode for CI smoke validation** (fast + deterministic)

This is the first version where:
> orchestration and infrastructure execution are cleanly separated.

---

# 🧱 Architecture Overview

## Control Plane (Worker runtime)

- API: `/workflow/start`, `/workflow/:id`, `/trace/:id`
- Durable Object: workflow orchestration engine
- D1: persistent state (runs, steps, deployments, jobs, events)

Responsibilities:
- workflow state machine
- step execution
- event emission (trace)
- dispatch external jobs
- resume after callback

---

## Execution Layer (Node runtime)

- `scripts/deploy/run-node-deploy.ts`
- `scripts/deploy/run-node-teardown.ts`

Responsibilities:
- execute real infrastructure actions
- call provider adapters (Cloudflare today)
- optionally post callback to control plane

---

## Provider Plugins

Located under:

```text
services/deployment-engine/src/providers/
```

Current:
- ✅ Cloudflare (wrangler-based)

Planned:
- AWS
- GCP

Design goal:
- no provider-specific logic in control-plane
- everything goes through adapters

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

## Teardown Modes

### Sync (CI / smoke)

- teardown executed inline in workflow engine
- workflow completes immediately
- used in staging deploy validation

### Async (normal operation)

```text
TEARDOWN
→ deploy_job.created
→ teardown.job_dispatched
→ step = waiting
→ external runner executes teardown
→ callback
→ workflow resumes
```

---

## External Job Model

Stored in `deploy_jobs` table:

- `queued`
- `running` (future)
- `succeeded`
- `failed`

Each job has:
- provider
- request payload
- callback token (hashed)
- lifecycle timestamps

---

# 🧪 CI / Deployment Flow

## Staging Deploy

GitHub Actions:

```text
npm test
→ generate build metadata
→ wrangler deploy
→ D1 migrations apply
→ wait for /healthz
→ verify SHA
→ smoke test (sync teardown)
```

Smoke test uses:

```json
{
  "teardown_mode": "sync"
}
```

This keeps CI:
- fast
- deterministic
- independent of async job runners

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

## 3. Start a workflow

### Sync teardown (CI-style)

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

Expected:
- workflow completes end-to-end

---

### Async teardown (real model)

```bash
curl -X POST http://127.0.0.1:8787/workflow/start \
  -H 'content-type: application/json' \
  -d '{
    "tenant_id": "t_demo",
    "project_id": "p_demo",
    "repo_url": "https://github.com/example/repo",
    "branch": "main",
    "service_name": "sample-worker",
    "teardown_mode": "async"
  }'
```

Expected:
- workflow pauses at `TEARDOWN = waiting`

---

## 4. Complete async teardown manually

### Step 1 — get trace

```bash
curl http://127.0.0.1:8787/trace/<trace_id>
```

Find:
- `job_id`
- `deployment_ref`

---

### Step 2 — get dispatch info

```bash
curl -H "authorization: Bearer <INTERNAL_JOB_API_TOKEN>" \
  http://127.0.0.1:8787/internal/deploy-jobs/<job_id>/dispatch-info
```

---

### Step 3 — run teardown

```bash
npm run teardown:node -- \
  --provider cloudflare \
  --deployment-ref <deployment_ref> \
  --callback-url http://127.0.0.1:8787/internal/deploy-jobs/<job_id>/callback \
  --callback-token <token>
```

---

### Step 4 — verify completion

```bash
curl http://127.0.0.1:8787/workflow/<run_id>
```

Expected:
- workflow resumes
- completes successfully

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

# ⚠️ Known Limitations (Commit 3)

- DEPLOY step is still simulated in workflow engine
- async job lifecycle lacks `running` state
- callback token handling is still evolving
- CI does not yet validate full async orchestration

---

# 🔜 Next Steps (Commit 3 continuation)

1. Externalize DEPLOY (same model as TEARDOWN)
2. Add job `running` state + events
3. Improve callback security (token handling)
4. Add async orchestration CI workflow
5. Expand provider adapters (AWS, GCP)
6. Improve observability (job + trace correlation)

---

# 🎯 MVP Definition (updated)

AEP is functional when:

- a repo can be deployed as a preview environment
- health + smoke checks run successfully
- workflow execution is fully observable via trace
- environment is fully torn down
- cleanup audit proves no resources remain
- orchestration and execution are cleanly separated

---

# 🧠 Design Principles

- control-plane is orchestration only
- infrastructure execution is externalized
- provider-specific logic lives in plugins
- workflows are observable, resumable, auditable
- CI is deterministic and minimal

---

# 🧪 Current Validation Status

- ✅ local workflow end-to-end (sync)
- ✅ local async teardown (manual completion)
- ✅ staging deploy + smoke test passing
- ✅ real Cloudflare deploy + teardown via node runner

---

# 📌 One-line summary

AEP now has a working control plane with externalized infrastructure execution, async job orchestration for teardown, and a clean path to fully externalized deploy in the next iteration.
