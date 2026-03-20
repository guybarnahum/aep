# AEP — Agentic Engineering Platform

A control plane for autonomous software systems.

This repository is structured to let the MVP grow into the full AEP platform without reorganizing the repo later.

## MVP target

The current MVP target is a **trusted preview lifecycle**:

1. create an ephemeral preview environment
2. deploy a Cloudflare Worker
3. run health and smoke checks
4. tear the preview down
5. prove cleanup via audit data and event trace

## Repository layout

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

## MVP components included

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

## Immediate next steps

1. Create a GitHub repo named `aep`
2. Copy this starter pack into the repo root
3. Create a D1 database and apply `infra/cloudflare/d1/migrations/0001_mvp.sql`
4. Deploy `examples/sample-worker`
5. Deploy `core/control-plane`
6. Call `POST /workflow/start` on the control plane
7. Iterate on the deployment adapter to replace placeholder deploy/test/teardown hooks

## Example request

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
