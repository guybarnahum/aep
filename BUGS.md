## 🐞 Bug Tracking — TUTORIAL.md Manual QA (commit 9c493e0)

Each bug follows this schema:

* **ID**
* **Area**
* **Severity**: (critical | high | medium | low)
* **Observed**
* **Expected**
* **Root Cause (hypothesis)**
* **Fix Suggestion (minimal)**
* **Validation Steps**
* **Status**: (open | fixed | validated)

---

### BUG-001 — Initiative Creation Bypasses Explicit Intake

* **Area**: Intake / Initiative Flow
* **Severity**: high
* **Observed**:
  UI allows direct "Create initiative" without going through Product intake flow.
  No visible intake object is created or surfaced.
* **Expected**:
  All work should originate from intake:
  intake → conversion → initiative
* **Root Cause (hypothesis)**:
  UI collapses intake + conversion into a single form without visibility or enforcement.
* **Fix Suggestion (minimal)**:
  Either:

  * enforce explicit intake creation, OR
  * clearly label as "Create intake (auto-converts)" and surface intake artifact
* **Validation Steps**:

  1. Attempt to create initiative directly
  2. Verify whether intake object exists and is visible
  3. Ensure no bypass of intake lifecycle
* **Status**: open

---

### BUG-002 — Task Graph Deadlock After Initiative Creation

* **Area**: Task Graph / Execution
* **Severity**: critical
* **Observed**:
  After initiative creation:

  * project_planning is "ready"
  * requirements_definition is "blocked"
  * task_graph_planning is "blocked"
    No tasks execute and system does not progress.
* **Expected**:
  At least one task should execute or be executable to bootstrap the system.
* **Root Cause (hypothesis)**:
  Missing execution trigger, worker pickup, or initial task kickoff.
* **Fix Suggestion (minimal)**:
  Ensure project_planning auto-executes or is picked up by execution loop.
* **Root Cause (confirmed)**:
  `runTeamWorkLoop` for `team_web_product` correctly picks up `ready` tasks. Execution was never triggered because no UI control existed on the initiative view to invoke the team work loop. The cron fallback must also be enabled in production for automatic pickup.
* **Fix Applied**:
  Added `ctx.waitUntil(runTeamWorkLoop(...))` after successful bootstrap in `routes/projects.ts` so the work loop fires automatically as a background task inside the same Worker invocation that creates the initiative. The HTTP `201` response is returned immediately; `project_planning` is picked up before the Worker shuts down, with no dependency on the cron scheduler.

  `ExecutionContext` is threaded through `dispatch` in `index.ts` into `handleCreateProject` as an optional parameter, so existing test callers are unaffected.

  Also added a \"Task execution\" card to the Product operator controls panel (`renderExecutionControls`) as a manual fallback for staging QA when the cron is inactive.
* **Validation Steps**:

  1. Create new initiative
  2. Observe task states — `project_planning` should be `ready`
  3. Open the initiative detail view; under "Product operator controls", click "Run team_web_product loop"
  4. Confirm `project_planning` transitions to `in_progress` or `completed`
  5. Subsequent tasks unblock as upstream tasks complete
* **Status**: fixed

---

### BUG-003 — No Artifact Production Pipeline Triggered

* **Area**: Artifact Pipeline
* **Severity**: high
* **Observed**:
  No artifacts are produced after initiative creation.
  deployment_candidate never appears.
* **Expected**:
  Task execution should produce artifacts leading to deployment_candidate.
* **Root Cause (hypothesis)**:
  Downstream effect of task graph deadlock.
* **Fix Suggestion (minimal)**:
  Fix task execution bootstrap (see BUG-002).
* **Validation Steps**:

  1. Create initiative
  2. Verify artifact creation occurs
  3. Confirm deployment_candidate appears when appropriate
* **Status**: open

---

### BUG-004 — employee_id Field Is Unvalidated Free Text

* **Area**: Identity / UX
* **Severity**: medium
* **Observed**:
  employee_id is a free-text input with no validation or guidance.
  User must guess values like "pm001".
* **Expected**:
  Employee identity should be:

  * selectable from existing employees OR
  * validated against registry
* **Root Cause (hypothesis)**:
  UI does not integrate with employee registry.
* **Fix Suggestion (minimal)**:
  Replace with dropdown or add validation + helper text.
* **Validation Steps**:

  1. Enter invalid employee_id
  2. Ensure UI rejects or validates
* **Status**: open

---

### BUG-005 — System Requires Manual Intervention to Start (Unclear Contract)

* **Area**: Execution Model / UX
* **Severity**: high
* **Observed**:
  After initiative creation, no work progresses automatically.
  It is unclear whether manual intervention is required.
* **Expected**:
  Either:

  * system auto-starts execution, OR
  * UI clearly instructs user to trigger initial action
* **Root Cause (hypothesis)**:
  Missing or unclear execution loop trigger.
* **Fix Suggestion (minimal)**:
  Either:

  * auto-start first task, OR
  * surface explicit "Start execution" control
* **Validation Steps**:

  1. Create initiative
  2. Do nothing
  3. Verify whether system progresses or clearly instructs user
* **Status**: open

---

### BUG-006 — Ready Tasks Are Not Executed and No Manual Runtime Trigger Exists

- **Area**: Runtime / Task Execution
- **Severity**: critical
- **Observed**:
  UI shows ready canonical tasks:
  - `project_planning`
  - `coordination`
  But no task progresses to running/completed, and no UI control exists to run, process, trigger, or inspect workers.
- **Expected**:
  Ready tasks should be picked up by the execution runtime, or a manual debug trigger should exist in non-production QA flows.
- **Root Cause (hypothesis)**:
  Execution loop is not running, not wired to ready tasks, or not exposed in the dashboard.
- **Fix Suggestion (minimal)**:
  Add runtime execution visibility and ensure ready tasks are processed by the operator/worker loop.
- **Root Cause (confirmed)**:
  The `POST /agent/teams/:teamId/run-once` route and `runTeamOnce` API were already implemented. The team detail view (`#team/:teamId`) had a "Run once" button but it was not reachable from the initiative/product flow view. The product operator panel had no execution control.
- **Fix Applied**:
  Added `renderExecutionControls` to the Product operator controls panel in the initiative detail view. The function reads `summary.tasks.active` to find teams with `ready` or `queued` tasks, and renders a per-team "Run [teamId] loop" button using the existing `data-action="run-team-once"` handler.

  Added `ctx.waitUntil(runTeamWorkLoop(...))` in `handleCreateProject` (`routes/projects.ts`) so that immediately after bootstrap succeeds, the team work loop fires as a background task inside the same Cloudflare Worker invocation. This means `project_planning` is picked up without waiting for the first cron tick. `ExecutionContext` is threaded through `dispatch` → `handleCreateProject`; it is optional so existing test callers are unaffected.
- **Validation Steps**:
  1. Create initiative
  2. Open initiative detail — "Product operator controls" panel shows "Task execution" card
  3. With `project_planning` ready, card shows "Run team_web_product loop" button
  4. Click button — `project_planning` progresses
  5. Repeat for other ready tasks as they appear
- **Status**: fixed

---

### BUG-007 — Dashboard Does Not Expose Runtime / Worker Health

- **Area**: Observability / Runtime UX
- **Severity**: high
- **Observed**:
  User cannot determine whether task execution is stopped, unavailable, paused, or failing.
  Dashboard exposes canonical state but not runtime health.
- **Expected**:
  Dashboard should show execution runtime status, last worker activity, or clear reason why ready tasks are not progressing.
- **Root Cause (hypothesis)**:
  Observability panel does not include execution runtime health.
- **Fix Suggestion (minimal)**:
  Add a runtime status panel showing worker availability, last task pickup, and last execution error.
- **Validation Steps**:
  1. Open initiative with ready tasks
  2. Confirm dashboard explains whether runtime is active
  3. Confirm failures are visible without inspecting backend logs
- **Status**: open

---

### BUG-008 — Lifecycle Approval Not Surfaced After Request

- **Area**: Lifecycle / Approvals / UI
- **Severity**: critical
- **Observed**:
  After requesting a lifecycle action (e.g., retire):
  - UI shows: “Lifecycle approval requested: approval_<id>”
  - A lifecycle coordination task is created and marked `ready`
  - BUT the Lifecycle controls panel still shows:
    “No lifecycle approvals found”
  - Initiative remains `active`
- **Expected**:
  The created lifecycle approval should appear in the approval selector so it can be approved and executed:
  request → approval visible → approve → execute → state transition
- **Root Cause (hypothesis)**:
  Approval query/filter in the dashboard does not include lifecycle approvals or filters them out (e.g., by project scope, type, or state mismatch)
- **Fix Suggestion (minimal)**:
  Ensure lifecycle approvals are returned and rendered in the approval dropdown for the current project
- **Validation Steps**:
  1. Request lifecycle action (retire)
  2. Verify approval appears in selector
  3. Approve lifecycle
  4. Execute lifecycle
  5. Confirm initiative transitions to `retired`
- **Status**: open