# AEP — Agentic Engineering Platform

A control plane for autonomous software systems.

This repository is structured to let the MVP grow into the full AEP platform without reorganizing the repo later.

---

# Current Status

## ✅ Commit 1 — Working

Commit 1 establishes the **end-to-end workflow skeleton** and proves that the core system can:

- accept a workflow request
- orchestrate execution via Durable Objects
- emit structured events
- simulate deploy / health / smoke / teardown steps
- persist execution data into D1

This is a **functional control plane loop**, with placeholder infrastructure hooks.

> The system runs locally and executes the full lifecycle with observability, but **does not yet validate real deployed services**.

---

## 🚧 Commit 2 — Next (Not yet implemented)

Commit 2 will:
- deploy to a real Cloudflare environment
- run **live `/healthz` checks**
- execute **real smoke tests against deployed services**
- gate success/failure on actual runtime behavior

---

# MVP target

The current MVP target is a **trusted preview lifecycle**:

1. create an ephemeral preview environment  
2. deploy a Cloudflare Worker  
3. run health and smoke checks  
4. tear the preview down  
5. prove cleanup via audit data and event trace  

---

# MVP definition of done

AEP is considered functional when:

- A repo can be deployed as a preview environment
- Health and smoke checks run successfully **against a live deployed service**
- The full execution is visible via event trace
- The environment is fully torn down
- Cleanup audit proves no resources remain

---

# What currently works (Commit 1)

## Workflow execution

- `POST /workflow/start` triggers a full workflow
- Workflow is orchestrated via Durable Object (`workflow-engine`)
- Steps execute in sequence:
  - deploy (placeholder)
  - health check (placeholder)
  - smoke test (placeholder)
  - teardown (placeholder)

## Observability

- Structured events emitted for each step
- Events stored in D1
- Execution trace can be reconstructed

## Data layer

- D1 schema applied via:
  - `infra/cloudflare/d1/migrations/0001_mvp.sql`
- Workflow runs persist execution + events

## Control plane

- `core/control-plane` Worker handles API
- Routes workflow requests into workflow engine

## Example service

- `examples/sample-worker` provides:
  - `/health` (basic)
  - `/hello`

> Note: this is not yet wired into the workflow for real validation (Commit 2)

---

# What is NOT implemented yet

- Real Cloudflare deployment integration
- Public staging/preview URLs
- `/healthz` contract and enforcement
- Real smoke tests against deployed service
- Cleanup validation against actual infra resources
- Failure gating (workflow always “succeeds” today)

---

# Repository layout

```text
.
├── apps/         # human-facing apps and operator surfaces
├── core/         # platform kernel: control plane, workflow engine, types, observability
├── infra/        # Cloudflare and GitHub infrastructure/config for AEP itself
├── packages/     # reusable shared packages
├── services/     # independently deployable backend services
├── examples/     # sample services for proving-ground and demos
├── docs/         # MVP docs and architecture decisions
└── scripts/      # local helpers
```

---

# MVP components included

- `core/control-plane/` — control-plane Worker entrypoint  
- `core/workflow-engine/` — preview lifecycle coordinator Durable Object  
- `core/observability/` — event emitter and event contracts  
- `packages/event-schema/` — shared event and workflow types  
- `services/deployment-engine/` — deploy adapter interface + placeholder Cloudflare adapter  
- `services/proving-ground/` — cleanup audit and smoke/health placeholders  
- `examples/sample-worker/` — reference Worker with `/health` and `/hello`  
- `apps/dashboard/` — minimal operator console stub  
- `infra/cloudflare/d1/migrations/` — D1 schema migration  
- `.github/workflows/` — preview deploy workflow template  

---

# How to run (local)

## 1. Setup D1

Create a D1 database and apply migrations:

```bash
wrangler d1 create aep-db
wrangler d1 migrations apply aep-db --local
```

## 2. Run control plane

```bash
cd core/control-plane
npm install
npx wrangler dev
```

## 3. Trigger a workflow

```bash
curl -X POST http://127.0.0.1:8787/workflow/start \
  -H 'content-type: application/json' \
  -d '{
    "tenant_id": "t_demo",
    "project_id": "p_demo",
    "repo_url": "https://github.com/example/repo",
    "branch": "main",
    "service_name": "sample-worker"
  }'
```

---

# Expected behavior (Commit 1)

- Workflow starts successfully
- Events are emitted for each phase
- Placeholder deploy/health/smoke/teardown steps execute
- Execution is recorded in D1

> This proves orchestration, not real infrastructure correctness.

---

# Next steps

## Commit 2 (high priority)

- Add `/healthz` endpoint contract
- Deploy services to real Cloudflare environment
- Add readiness wait + retry logic
- Implement real health checks
- Implement real smoke tests
- Fail workflows on real errors

## Commit 3 (planned)

- Deployment evidence + audit trail
- Rollback hooks
- Observability UI improvements

---

# Design principles

- **Workflow-first**: everything is modeled as an execution graph
- **Observable by default**: every step emits structured events
- **Infra-agnostic core**: deployment adapters are pluggable
- **Deterministic cleanup**: teardown must be provable

---

# Summary

Commit 1 delivers:

> A working control plane that can orchestrate and observe a full preview lifecycle locally.

Commit 2 will deliver:

> A trusted system that validates real deployed services in live environments.

```
