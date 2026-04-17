# Operator Agent — Autonomous Infrastructure Operators

The operator-agent is a network of autonomous workers that implement AEP's infra department capabilities.

Current repo state:

- operator-agent governance and runtime control state is persisted in D1
- the control-plane now exposes separate org inventory APIs backed by the Commit 13 catalog substrate
- that org catalog is still additive; operator-agent execution remains source-configured until later catalog-authoritative commits land

---

## Architecture Layers

### Employee Model

The operator-agent implements an **employee-based actor model**:

- Each employee is a durable digital person rather than an ephemeral agent
- Each employee has an `employeeId`, `roleId`, `authority`, and `budget`
- Each role is expected to have a public job description that defines responsibilities, success metrics, and constraints
- Employees operate independently within their constraints
- Employees can coordinate and escalate to managers when needed

Public profile and private cognition remain separate. The operator-agent may publish bounded public rationale, but it should not expose private prompts or internal reasoning through its public surfaces.

### Employment vs Runtime Control

The operator-agent currently governs **runtime control**, not the full employment lifecycle.

- `disabled_pending_review`, `disabled_by_manager`, and `restricted` are runtime control states
- employment states such as `on_leave` or `terminated` belong to the broader employee model
- these concepts should not be conflated in API semantics or documentation

### Persistence Boundary

The operator-agent keeps storage abstractions and runtime orchestration in `src/lib`, while Cloudflare D1-backed implementations live in `src/persistence/d1`.

- `src/lib` contains storage-agnostic runtime logic, interfaces, and composition
- `src/persistence/d1` contains the D1 adapter layer used by the runtime at execution time
- `infra/cloudflare/d1` contains schema migrations and provisioning concerns, not runtime store code

### Departments

Employees are organized into **departments** (currently: `aep-infra-ops`):

- departments own a set of employees
- departments have a manager (infra-ops-manager) for supervision
- managers make decisions at the department level, not individual employee level

### Operators

Current operators:

1. **timeout-recovery-operator** — autonomous recovery from timeouts
2. **retry-supervisor** — multi-worker cross-worker pattern detection
3. **infra-ops-manager** — supervisory decisions on department patterns
4. **teardown-safety-operator** — cleanup and safety checks
5. **incident-triage-operator** — triage of infrastructure issues

---

## Company Handoff & Paperclip Integration

### Execution Model: Paperclip-First

The operator-agent is designed for **company-driven execution**:

- Primary entry point: `/agent/run` (Paperclip company calls this)
- Execution provenance is mandatory via `x-aep-execution-source`
- Trigger: `"paperclip"` — indicates external company/agent coordination
- Fallback mode: `"cron_fallback"` — scheduled bootstrap/degraded mode only

Valid `x-aep-execution-source` values:

- `paperclip`
- `operator`
- `test`

If the header is missing, `/agent/run` returns `400`.

#### Request Structure (Paperclip → Operator)

Headers:

```text
x-aep-execution-source: paperclip
x-paperclip-shared-secret: <optional, required only when PAPERCLIP_AUTH_REQUIRED=true>
```

```json
{
  "departmentId": "aep-infra-ops",
  "employeeId": "emp_infra_ops_manager_01",
  "roleId": "infra-ops-manager",
  "trigger": "paperclip",
  "policyVersion": "commit10-stageD",
  "companyId": "company-12345",
  "heartbeatId": "hb-...",
  "taskId": "task-...",
  "targetEmployeeIdsOverride": ["emp_timeout_recovery_01"]
}
```

Required Paperclip fields:

- `companyId`
- `taskId`
- `heartbeatId`

Optional hardening env vars:

- `PAPERCLIP_AUTH_REQUIRED` (`true|false`)
- `PAPERCLIP_SHARED_SECRET`

Fallback env var:

- `AEP_CRON_FALLBACK_ENABLED` (`true|false`)

#### Response Structure (Operator → Paperclip)

```json
{
  "ok": true,
  "executionContext": {
    "executionSource": "paperclip",
    "companyId": "company-12345",
    "taskId": "task-...",
    "heartbeatId": "hb-...",
    "receivedAt": 1743000000000
  },
  "routing": {
    "employeeId": "emp_infra_ops_manager_01",
    "workerId": null
  },
  "executionSource": "paperclip",
  "cronFallbackRecommended": false,
  "request": { /* adapted employee run request */ },
  "result": { /* employee/manager execution result */ }
}
```

**Key fields:**

- `executionSource: "paperclip"` — this was company-driven execution, not cron fallback
- `executionContext.executionSource: "paperclip"` — explicit provenance for audit/logging
- `cronFallbackRecommended: false` — no need to re-invoke via cron
- `routing` — resolved employee/worker targeting used for this run

Scheduler mode visibility:

- `GET /agent/scheduler-status` returns:
  - `primaryScheduler: "paperclip"`
  - `cronFallbackEnabled: boolean`

### Company Responsibility

When the company receives a response with `escalationsCreated > 0`:

1. Fetch `/agent/escalations` to see what issues were escalated
2. Review the escalation severity, reason, and affected employees
3. Decide on intervention:
   - acknowledge the escalation
   - resolve it (if root cause addressed at company level)
   - override the operator's recommendation

The company becomes the **accountable decision-maker** for escalated issues, while the operator remains accountable for observational accuracy.

---

## Escalation Lifecycle

Escalations are **stateful governance objects**, not just write-once signals. Each escalation moves through an explicit lifecycle:

```
open → acknowledged → resolved
```

**Invariants:**
- No backward transitions (resolved cannot go back to acknowledged)
- No implicit or automatic transitions
- All transitions require an explicit operator API call
- Every transition records `actor`, `timestamp`, and optional `note`

### Transitions

#### Acknowledge

```
POST /agent/escalations/acknowledge?id=<escalationId>
Headers: x-actor: <actor-id>
```

Moves an escalation from `open` → `acknowledged`. Records `acknowledgedAt` and `acknowledgedBy`.

```json
{
  "ok": true,
  "escalation": {
    "escalationId": "...",
    "state": "acknowledged",
    "acknowledgedAt": "2025-01-15T10:35:00Z",
    "acknowledgedBy": "company-operator"
  }
}
```

#### Resolve

```
POST /agent/escalations/resolve
Content-Type: application/json
Headers: x-actor: <actor-id>

{ "id": "<escalationId>", "note": "Root cause fixed: budget limits updated" }
```

Moves an escalation from `acknowledged` → `resolved`. Records `resolvedAt`, `resolvedBy`, and optional `resolutionNote`.

#### Invalid Transitions

Attempting an invalid transition (e.g. `open → resolved`, or re-acknowledging) returns `HTTP 400`:

```json
{ "ok": false, "error": "Invalid escalation transition: open → resolved" }
```

### State Filtering

```
GET /agent/escalations?state=open&limit=20
GET /agent/escalations?state=acknowledged&limit=20
GET /agent/escalations?state=resolved&limit=20
```

### Schema (with lifecycle fields)

```json
{
  "escalationId": "2025-01-15T10:30:00Z:cross_worker_budget_pressure:department",
  "timestamp": "2025-01-15T10:30:00Z",
  "state": "open | acknowledged | resolved",
  "acknowledgedAt": "...",
  "acknowledgedBy": "...",
  "resolvedAt": "...",
  "resolvedBy": "...",
  "resolutionNote": "..."
}
```

---

## Escalation System

### What Triggers an Escalation

An escalation record is created when a manager decision is:

- **Critical severity**, OR
- Reason is one of:
  - `cross_worker_budget_pressure` (multi-employee pattern)
  - `cross_worker_failure_pattern_detected` (systemic issue)
  - `repeated_verification_failures` (persistent single-employee issue)
  - `operator_action_failures_detected`
  - `frequent_budget_exhaustion`

### Escalation Record Schema

```json
{
  "escalationId": "2025-01-15T10:30:00Z:cross_worker_budget_pressure:department",
  "timestamp": "2025-01-15T10:30:00Z",
  "companyId": "company-12345",
  "departmentId": "aep-infra-ops",
  "managerEmployeeId": "emp_infra_ops_manager_01",
  "severity": "critical|warning",
  "state": "open|acknowledged|resolved",
  "reason": "cross_worker_budget_pressure | cross_worker_failure_pattern_detected | ...",
  "affectedEmployeeIds": ["emp_timeout_recovery_01"],
  "message": "Two workers exhausted budget in same time window",
  "recommendation": "rebalance_team_capacity | pause_one_worker_keep_one_active | recommend_budget_adjustment | escalate_to_human",
  "evidence": {
    "windowEntryCount": 50,
    "resultCounts": { "timeout": 20, "error": 15, "success": 15 },
    "perEmployee": [ /* aggregated summary per affected employee */ ]
  }
}
```

### API Routes

#### GET `/agent/escalations?limit=50&state=open`

Fetch recent escalation records, optionally filtered by state._

```json
{
  "ok": true,
  "count": 12,
  "escalations": [ /* escalation records */ ]
}
```

#### GET `/agent/control-history?employeeId=emp_123&limit=100`

Fetch the audit trail of state transitions for an employee's runtime control state.

_Response:_

```json
{
  "ok": true,
  "count": 45,
  "entries": [
    {
      "historyId": "emp_timeout_recovery_01:2025-01-15T10:30:00Z",
      "timestamp": "2025-01-15T10:30:00Z",
      "employeeId": "emp_timeout_recovery_01",
      "previousState": {
        "state": "enabled",
        "blocked": false
      },
      "nextState": {
        "state": "restricted",
        "blocked": false
      },
      "transition": "enabled → restricted",
      "reason": "repeated_verification_failures",
      "updatedByEmployeeId": "emp_infra_ops_manager_01",
      "policyVersion": "commit10-stageD"
    }
  ]
}
```

---

## Auditability

### Policy Versioning

The `policyVersion` field enables **auditable governance transitions**:

- Every decision, escalation, and runtime control state change records its policy version
- Audit trail links decision to specific policy version
- Company can reason about "what policy generated this decision"
- Policy upgrades can be audited for impact

Current: `commit10-stageD`

### Trace Trail

All three logs are **append-only, immutable**:

1. **Agent Work Log** — `/agent/work-log`
   - Raw observations per operator
   - timing, inputs, outputs
   
2. **Manager Decision Log** — `/agent/manager-log`
   - Supervisory decisions
   - per-decision reasoning and evidence
   
3. **Escalation Log** — `/agent/escalations`
   - Issues escalated to company
   - severity, affected parties, recommendations

4. **Control History** — `/agent/control-history`
  - Runtime control transitions per employee
   - who changed it, why, when, under which policy

### Governance Hints

Each employee in `/agent/employees` includes:

```json
{
  "governance": {
    "companyPrimaryEntryPoint": "/agent/run",
    "cronFallbackEnabled": true,
    "escalationRoute": "/agent/escalations",
    "controlHistoryRoute": "/agent/control-history?employeeId=emp_timeout_recovery_01"
  }
}
```

This explicitly tells the company:

- "Call `/agent/run` to coordinate with me"
- "I can bootstrap via cron if you don't call frequently"
- "My escalations and audit trail are at these routes"

---

## CI Validation

### operator-surface-check

Validates the employee/capability surface:

- 3+ employees registered
- routes respond with expected structures
- escalations and control-history routes exist
- async-validation can also verify the separate control-plane org schema and org inventory APIs that now sit beside the operator-agent surface

### manager-advisory-check

Validates manager decisions and escalations:

- Manager can be invoked
- escalationsCreated count is consistent
- escalations audit log reflects the created escalations

### paperclip-company-handoff-check

Validates Paperclip-first execution semantics:

- `/agent/run` with `trigger: "paperclip"` returns `executionSource: "paperclip"`
- `cronFallbackRecommended: false` (Paperclip is now the primary)
- Company metadata is forwarded through the request

### escalation-audit-check

Validates the full audit trail:

- Manager invocation creates decision+escalation records
- escalations and control-history logs are populated
- escalation severity/status/reason are well-formed
- runtime control transitions are auditable

---

## Constraints

### No External Notifications

The operator-agent **does not call external services**. It only:

- Accepts requests from the company (`/agent/run`)
- Returns decisions and audit trails
- Stores immutable governance and audit state through the D1-backed persistence layer

All escalations must be fetched by the company via explicit API calls.

### No New Mutation Paths

The executor and control flow remain unchanged. Escalations are:

- Purely informational (reporting layer)
- Immutable logs
- Company-read, company-acts

No hidden auto-escalation or supervisor overrides.

### Cron as Fallback, Not Primary

Scheduled cron is for **bootstrap and liveness checks**, not primary operation:

- Paperclip heartbeats drive supervisor reviews
- Cron ensures minimum liveness if Paperclip is unavailable
- `/agent/run` responses indicate if cron is still needed (`cronFallbackRecommended`)

---

## Example Workflow

1. **Company initiates**: Paperclip calls `/agent/run` with company metadata
2. **Operator executes**: Manager reviews employees, makes decisions
3. **Escalation created**: Critical pattern detected, escalation record written
4. **Company fetches**: Calls `/agent/escalations` to see what needs attention
5. **Company reviews**: Checks control history, decides on intervention
6. **Audit trail**: Full decision record with policy version linked to company's action

No surprises, no backdoors, fully observable.
