# AEP — Agentic Engineering Platform

A control plane for autonomous infrastructure operations.

---

## Vision

AEP is the foundation of a **zero-employee infrastructure company**.

It is designed to enable systems that can:

- deploy software
- validate it
- operate it
- observe and intervene
- and eventually improve themselves

AEP is not just tooling.

It is the **infra department kernel** of an agentic company.

---

## Conceptual Model

### AEP as an Infra Department

AEP should be thought of as:

> a self-operating **infrastructure department**

Inside a larger agentic organization (e.g. Paperclip-style company).

It is responsible for:

- deployment lifecycle
- validation and safety checks
- teardown and cleanup
- operational observability
- safe intervention

And it provides these as services to:

- internal tenants (dogfooding)
- external customers (multi-tenant infra platform)

This mirrors how:

> AWS began as Amazon’s internal infra team and became a standalone business.

---

## Architectural Boundary

AEP is **not** the company layer.

It integrates into a broader agentic system:

### Company layer (e.g. Paperclip)
Owns:
- org structure (departments, employees)
- budgets and cost control
- governance / approvals
- heartbeat scheduling
- multi-company isolation

### AEP (infra department)
Owns:
- workflow orchestration
- job/attempt lifecycle
- operator APIs
- trace-first observability
- safe infra mutations

---

## Core Principles

### 1. Control-plane is orchestration-only

- no provider logic leakage
- no direct execution
- external execution model (deploy/teardown)

---

### 2. Trace-first system

- `/trace/:id` is authoritative
- all state transitions observable
- no hidden behavior

---

### 3. Operator APIs are the only mutation path

- human and agent use the same APIs
- no privileged backdoors
- no side-channel mutations

---

## Storage Architecture

- control-plane runtime state is persisted in D1
- operator-agent governance state is persisted in D1 as the sole system of record
- operator-agent state (governance, budget, cooldown, etc.) is now persisted exclusively in D1
- operator-agent KV is no longer used for any state persistence
- all operator-agent APIs and test/seed paths read and write via D1-backed store abstractions

---

### 4. Logical job abstraction

- jobs are the unit of reasoning
- attempts are implementation detail
- retries and timeouts are internal mechanics

---

### 5. Provider neutrality

- current: Cloudflare Workers
- future: AWS / GCP / others

---

## Repository Layout

```text
.
├── apps/                 # operator UI surfaces
│   ├── ops-console
│   └── dashboard
├── core/
│   ├── control-plane     # orchestration engine + APIs
│   └── operator-agent    # autonomous employees (Commit 8)
├── infra/                # deployment / CI
├── scripts/              # validation + CI scripts
```

---

## Current Status — Commit 13.2

AEP is now a:

> **working control plane + autonomous operator department + org catalog substrate**

## In Progress

- Commit 13.1 added the D1-backed org catalog substrate: companies, teams, org tenants, tenant environments, services, employees, and scope bindings.
- Commit 13.2 added read-only control-plane inventory APIs backed by that catalog.
- Preview environments are now PR-scoped, destroyed on PR close, and backstopped by a scheduled reaper.

## Current Platform Snapshot

- control-plane runtime state is persisted in D1 and now exposes both legacy runtime routes and new org inventory routes
- operator-agent governance and control state is persisted in D1; KV is no longer the system of record
- async-validation now verifies org schema seed state and org inventory route availability
- preview deploys are PR-only and use ephemeral Worker + D1 resources with automated teardown and backstop garbage collection

---

## What is working end-to-end

### Control-plane

- Durable Object–based orchestration
- async external execution model
- deploy + teardown lifecycle
- logical job + attempt model
- retries with bounded attempts
- timeout handling
- resume after async pause
- provider-neutral abstraction

---

### Operator surface (Commit 6–7)

- Legacy runtime/operator routes:
- `/runs`
- `/runs/:id`
- `/runs/:id/jobs`
- `/tenants`

- Org inventory routes (Commit 13.2):
- `/companies`
- `/teams`
- `/org/tenants`
- `/services`
- `/employees`

Includes:
- job + attempt visibility
- derived job status
- failure classification
- read-only org catalog inventory backed by seeded D1 catalog rows

---

### Operator actions (Commit 7)

- `POST /operator/jobs/:jobId/advance-timeout`

Properties:
- reuses existing timeout/retry semantics
- no new mutation paths
- safe intervention model

---

### Observability

- `/trace/:id` is authoritative
- includes:
  - attempt lifecycle
  - failure_kind
  - retry events
  - operator events:
    - `operator.action_requested`
    - `operator.action_applied`

---

## Agentic Operator Layer (Commit 8)

AEP now includes its **first autonomous employee**.

---

### Operator-agent service

New service:

```text
core/operator-agent
```

Responsibilities:

- executes agent loops
- enforces budgets and safety
- calls control-plane APIs
- verifies outcomes via trace
- emits structured work logs

---

### First employee

#### Timeout Recovery Operator

Role:
- detect stuck / timeout-eligible jobs
- safely advance them using existing operator API
- verify outcome through trace

---

### Execution model

#### Manual
```
POST /agent/run-once
```

#### Autonomous (cron)
- runs every minute
- same execution path as manual
- no special behavior

---

### Behavior

For each run:

1. read runs and jobs
2. detect:
   - `operator_actions.can_advance_timeout`
3. enforce:
   - per-scan budget
   - per-hour budget
   - per-tenant budget
   - cooldown / dedupe
4. act:
   - `POST /operator/jobs/:jobId/advance-timeout`
5. verify:
   - `/trace/:id`
   - must include:
     - `operator.action_requested`
     - `operator.action_applied`

---

### Safety model

- no direct DB access
- no DO internal mutation
- no new mutation semantics
- trace verification required
- budgets enforced before action
- cooldown prevents repeated actions
- dev/qa scoped (no prod autonomy yet)

---

### Budget model

- max actions per scan
- max actions per hour
- max actions per tenant per hour

---

### Cooldown model

- per-job cooldown window
- prevents rapid re-application
- persisted through the operator-agent D1-backed governance layer

---

### Work log (employee record)

Stored through the operator-agent persistence layer.

Each entry includes:
- employee identity
- run/job
- action taken
- reason
- budget snapshot
- result
- trace evidence
- error (if any)

---

### Debug route

```
GET /agent/work-log?limit=20
```

Returns recent employee activity.

---

### CI validation

Script:

```text
scripts/ci/agent-timeout-recovery-check.ts
```

Validates:

1. finds eligible job
2. runs agent
3. verifies:
   - operator action occurred
   - trace contains expected events
4. reruns agent
5. verifies:
   - cooldown / budget / eligibility prevents duplicate action

Additional current validation includes:

- org schema seed validation against the control-plane D1 catalog
- org inventory route validation against `/companies`, `/teams`, `/org/tenants`, `/services`, and `/employees`

---

### Adaptive policy overlays (Commit 10B)

AEP can now persist manager-issued runtime overlays through employee controls.

These overlays can restrict:

- **budget**
  - `maxActionsPerScan`
  - `maxActionsPerHour`
  - `maxActionsPerTenantPerHour`

- **authority**
  - `allowedTenants`
  - `allowedServices`
  - `requireTraceVerification`

Effective execution policy is resolved in one place:

```text
base employee config
  → control overlay
  → request override
```

This keeps behavior explicit, observable, and reversible without introducing any new mutation path.

#### Key features

- `restricted` state: employee remains runnable but with narrowed scope
- `/agent/employees`: exposes both base and effective policy
- Manager can restrict and clear restrictions without full disable
- All enforcement centralized in executor

#### Control lifecycle states

- `enabled`: fully operational
- `disabled_pending_review`: blocked, awaiting manager review
- `disabled_by_manager`: blocked, permanently disabled locally
- `restricted`: runnable but with persisted overlays

---

## Multi-Worker Department (Commit 10C)

AEP now runs a **real three-employee small department**:

| Employee | Role | Scope |
|---|---|---|
| `emp_timeout_recovery_01` | `timeout-recovery-operator` | all tenants |
| `emp_retry_supervisor_01` | `retry-supervisor` | `qa`, `internal-aep` |
| `emp_infra_ops_manager_01` | `infra-ops-manager` | supervises both workers |

### Worker cron

Both `timeout-recovery-operator` and `retry-supervisor` run on every cron tick via a team loop. Each result includes a `workerRole` field identifying the responsible worker.

### Manager supervision

The manager now observes **both workers** in a single cron evaluation:

- fetches work logs per employee
- applies the same per-employee control logic (disable / restrict / clear)
- detects cross-worker patterns:
  - `cross_worker_budget_pressure`: combined budget exhaustion ≥ 4 signals → recommend `rebalance_team_capacity`
  - `cross_worker_failure_pattern_detected`: combined verification + action failures ≥ 2 → recommend `pause_one_worker_keep_one_active`
- returns `observedEmployeeIds[]`, `scanned.employeesObserved`, `summary.crossWorkerAlerts`, `perEmployee[]`

### Run-once with employee selection

`POST /agent/run-once?employeeId=emp_retry_supervisor_01` selects a specific worker; defaults to `timeout-recovery-operator` if omitted.

### CI validation

Script:

```text
scripts/ci/multi-worker-department-check.ts
```

Validates:

1. all three employees present (`count >= 3`)
2. retry-supervisor run returns correct `workerRole`
3. manager observes both workers with matching `perEmployee` summaries
4. `crossWorkerAlerts` field present in manager summary

---

## What we have now (conceptually)

We have built:

> a **human + agent operated infra control plane**

Equivalent to:

- a highly skilled infra operator
- plus one autonomous junior operator
- both using the same safe interface

---

## What is next

To reach a true zero-employee infra company:

### Stage 1 (done)
- first autonomous operator (timeout recovery)

### Stage 2
- policy overlays and governance controls

### Stage 3
- expanded autonomous operator department and Paperclip-first execution

### Stage 4
- org catalog-backed inventory APIs and company/org substrate

### Stage 5
- catalog-authoritative execution and richer company integration

---

## Integration with Agentic Company (Paperclip)

AEP is designed to plug into a company layer:

### Paperclip owns
- employee identity
- budgets
- governance
- heartbeat scheduling

### AEP owns

Future integration:

```text
Paperclip heartbeat
  → operator-agent run request
      → AEP APIs
          → trace verification
              → structured result back to company layer

### Paperclip-First Execution (Commit 11D)

AEP now treats Paperclip as the primary scheduler and authority source.

Execution provenance is explicit and required on `/agent/run`:

- `x-aep-execution-source: paperclip|operator|test`

Paperclip requests must include:

- `companyId`
- `taskId`
- `heartbeatId`

Optional hardening can be enabled with:

- `PAPERCLIP_AUTH_REQUIRED`
- `PAPERCLIP_SHARED_SECRET`

Cron remains available only as fallback and is marked as `cron_fallback` in
execution context and logs. Fallback mode can be toggled with:

- `AEP_CRON_FALLBACK_ENABLED`

Operator-facing scheduler mode is available via:

- `GET /agent/scheduler-status`

```

---

## One-line summary

> AEP is the infra department of a zero-employee company — and Commit 8 is its first autonomous employee.