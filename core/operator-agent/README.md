# Operator Agent — Autonomous Infrastructure Operators

The operator-agent is a network of autonomous workers that implement AEP's infra department capabilities.

---

## Architecture Layers

### Employee Model

The operator-agent implements an **employee-based actor model**:

- Each employee has an `employeeId`, `roleId`, `authority`, and `budget`
- Employees operate independently within their constraints
- Employees can coordinate and escalate to managers when needed

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
- Trigger: `"paperclip"` — indicates external company/agent coordination
- Fallback: `"cron"` — scheduled bootstrap (not primary)

#### Request Structure (Paperclip → Operator)

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

#### Response Structure (Operator → Paperclip)

```json
{
  "ok": true,
  "executionSource": "paperclip",
  "cronFallbackRecommended": false,
  "summary": {
    "decisionsEmitted": 5,
    "escalationsCreated": 2,
    "crossWorkerAlerts": 1
  },
  "perEmployee": [ /* per-employee decisions */ ],
  "decisions": [ /* full decision records */ ]
}
```

**Key fields:**

- `executionSource: "paperclip"` — this was company-driven execution, not cron fallback
- `cronFallbackRecommended: false` — no need to re-invoke via cron
- `escalationsCreated: N` — number of issues escalated to company for review

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

Fetch the audit trail of state transitions for an employee's control state.

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

- Every decision, escalation, and control state change records its policy version
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
   - State transitions per employee
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
- control state transitions are auditable

---

## Constraints

### No External Notifications

The operator-agent **does not call external services**. It only:

- Accepts requests from the company (`/agent/run`)
- Returns decisions and audit trails
- Stores immutable logs in KV

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
