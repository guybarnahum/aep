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

---

## ⚡ Commit 2 — Partially Implemented (In Progress)

Commit 2 has been **partially implemented in the repository**, introducing real deployment validation primitives and CI gating.

### ✅ Implemented

- `/healthz` endpoint with:
  - structured health response
  - build metadata (`service`, `env`, `version`)
  - D1 connectivity check
- `build-info` module for normalized runtime metadata
- CI verification scripts:
  - `scripts/ci/wait-for-url.ts`
  - `scripts/ci/check-health.ts`
  - `scripts/ci/smoke-test.ts`
- GitHub Actions workflows:
  - staging deploy workflow (needs alignment cleanup)
  - production deploy workflow with environment protection
- Deployment gating model:
  - wait → health → smoke → success

### ⚠️ Current Limitations

- Workflow engine deploy/teardown steps are still **simulated**
- Real deployment is executed via **CI / Node runner**, not inside Worker runtime
- Cleanup audit is **database-based**, not infra-verified
- Staging workflow still uses older script interface (needs update)

> The system now supports **real deployment validation in CI**, but the internal workflow engine is not yet fully wired to live infrastructure.

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

# What currently works

## Workflow execution (control plane)

- `POST /workflow/start` triggers a workflow run
- Workflow is orchestrated via Durable Object (`workflow-engine`)
- Steps execute in sequence:
  - environment creation
  - deploy (**simulated inside Worker**)
  - health check (placeholder)
  - smoke test (placeholder)
  - teardown (placeholder)
- Workflow state is persisted in D1

## Observability

- Structured events emitted for each step
- Events stored in D1
- Execution trace can be reconstructed
- Trace IDs flow across workflow lifecycle

## CI / Deployment validation (Commit 2)

- Deployments validated via GitHub Actions:
  - wait for readiness (`wait-for-url`)
  - validate `/healthz`
  - execute smoke test
- Deployments fail if live service is unhealthy or broken
- Production deploy is gated by GitHub Environment approval

## Health system

- `/healthz` endpoint provides:
  - `ok` status
  - service/env/version metadata
  - runtime checks (including D1)

## Data layer

- D1 schema:
  - workflows
  - environments
  - deployments
  - events
- Migration:
  - `infra/cloudflare/d1/migrations/0001_mvp.sql`

## Example service

- `examples/sample-worker` provides:
  - `/health`
  - `/hello`
- Intended for CI smoke validation

---

# What is NOT fully implemented yet

- Workflow engine executing **real deployments**
- Worker-side health/smoke checks against live services
- Real teardown of deployed infrastructure
- Cleanup verification against actual provider state
- Unified deploy runner / job system
- Staging workflow alignment with CI scripts (still partially outdated)

---

# Repository layout

```text
.
├── apps/         # human-facing apps and operator surfaces
├── core/         # control plane, workflow engine, types, observability
├── infra/        # Cloudflare + GitHub configuration
├── packages/     # shared contracts and schemas
├── services/     # backend services (deployment-engine, proving-ground)
├── examples/     # sample services for testing
├── docs/         # architecture + MVP design
└── scripts/      # CI and local tooling
```

---

# MVP components included

- `core/control-plane/` — Worker API + routing + `/healthz`  
- `core/workflow-engine/` — Durable Object orchestration engine  
- `core/observability/` — event emitter + trace model  
- `core/types/` — shared environment and runtime types  
- `packages/event-schema/` — workflow + event contracts  
- `services/deployment-engine/` — deployment abstraction (worker-safe + node adapters)  
- `services/proving-ground/` — placeholder health/smoke/cleanup checks  
- `examples/sample-worker/` — test Worker service  
- `apps/dashboard/` — operator UI stub  
- `infra/cloudflare/d1/migrations/` — database schema  
- `.github/workflows/` — deploy + validation pipelines  

---

# How to run (local)

## 1. Setup D1

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

# Expected behavior (current)

- Workflow executes end-to-end
- Events are emitted and stored
- Deploy/health/smoke/teardown steps are **simulated inside Worker**
- CI pipelines perform **real validation against deployed services**

> Today: orchestration is real, deployment validation is real (via CI), but workflow-internal infra execution is still simulated.

---

# Next steps

## Commit 2 completion

- Align staging workflow with CI scripts (`scripts/ci/...`)
- Add async polling for workflow completion in smoke tests
- Standardize response contracts (`workflow_run_id`)
- Introduce real deploy execution via:
  - CI callback model, or
  - deploy-runner service

## Commit 3 (planned)

- External deploy job system (queue + callbacks)
- Real teardown + infra audit
- Rollback / failure recovery
- Observability UI (dashboard)
- Multi-service / multi-tenant support

---

# Design principles

- **Workflow-first** — everything is an execution graph  
- **Observable by default** — all steps emit structured events  
- **Strict boundaries** — Worker runtime ≠ Node execution  
- **CI as truth** — deployments are validated against live systems  
- **Pluggable infra** — deployment adapters are replaceable  
- **Deterministic cleanup** — teardown must be provable  

---

# Summary

Commit 1 delivers:

> A working control plane with full workflow orchestration and observability.

Commit 2 (current state) delivers:

> Real deployment validation via CI (health + smoke), with partial integration into the platform.

Next milestone:

> Fully unify workflow engine + deployment execution into a trusted, end-to-end autonomous deployment system.