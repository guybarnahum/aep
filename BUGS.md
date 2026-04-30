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
* **Status**: open (see BUG-009, BUG-010)

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
- **Status**: open (see BUG-009, BUG-010)

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

---

### BUG-009 — Task Execution Button Renders But Does Not Trigger Visible Execution

- **Area**: Dashboard / Runtime Execution
- **Severity**: critical
- **Observed**:
  The Product operator controls panel renders:
  `Run team_web_product loop`

  After clicking it:
  - mutation status does not change
  - task state does not change
  - `project_planning` remains `ready`
  - downstream tasks remain `blocked`
  - no artifacts are produced
- **Expected**:
  Clicking `Run team_web_product loop` should call the canonical team execution route and cause at least one ready task to transition to `in_progress`, `completed`, `failed`, or visible execution error.
- **Root Cause (confirmed)**:
  The `productInitiative` route attachment block called only `attachProductInterventionHandlers` and `attachProductOperatorControlHandlers`. The `run-team-once` click handler lives exclusively in `attachTeamLoopHandlers`, which was never called for the `productInitiative` route. The button was rendered but unlistened.
- **Fix Applied**:
  Added `attachTeamLoopHandlers()` to the `productInitiative` attachment block in `main.ts`. After clicking, mutation status shows `Running team_web_product once…` then `Ran team loop for team_web_product: <status>.`. The last loop result (status, scanned counts, task link, message) is now displayed inline in the Task execution card via `renderExecutionControls(summary, lastTeamLoopResult)`, so the result is visible without reopening the teams view.
- **Validation Steps**:
  1. Open initiative with `project_planning` ready
  2. Click `Run team_web_product loop`
  3. Confirm mutation status changes to `Ran team loop for team_web_product: <status>`
  4. Confirm task state changes or execution result message is shown in the card
- **Status**: fixed (BUG-010 tracks whether execution actually advances the task)

---

### BUG-010 — Auto-Execution After Initiative Creation Does Not Advance Ready Task

- **Area**: Runtime / Initiative Bootstrap
- **Severity**: critical
- **Observed**:
  After creating a fresh product initiative on build `4bce394`, `Plan product initiative` remains `ready`.
  No automatic execution is observed after refresh.
- **Expected**:
  `ctx.waitUntil(runTeamWorkLoop(...))` should pick up the initial `project_planning` task after initiative bootstrap.
- **Root Cause (hypothesis)**:
  The background work loop is not executing, exits with no visible error, cannot resolve runtime staffing, or fails before changing task state. Most likely `resolveRuntimeEmployeesForTeam` returns an empty roster for `team_web_product` (no active employee with `runtime_enabled = 1` in `employees_catalog` / `roles_catalog`), causing `waiting_for_staffing` silently.
- **Fix Applied (partial)**:
  Added `.then(result => console.log(...)).catch(error => console.error(...))` around the `ctx.waitUntil` call so that the exact result (`status`, scanned counts, message) or error is visible in Worker logs. QA should check Cloudflare worker logs for `[projects] bootstrap work loop result` after creating a new initiative to confirm whether the failure is `waiting_for_staffing`, `no_pending_tasks`, or an unhandled error.
- **Next Step**:
  If logs show `waiting_for_staffing`: confirm `team_web_product` has at least one active, runtime-enabled employee row in D1. If not, the dev bootstrap or seed is incomplete.
  If logs show `no_pending_tasks`: the task was not created or the companyId filter is mismatched.
  If logs show `execution_failed`: PM agent ran but threw; check `result.message`.
- **Validation Steps**:
  1. Create fresh initiative
  2. Check Cloudflare worker logs for `[projects] bootstrap work loop result`
  3. Confirm `project_planning` moves beyond `ready`, OR surface exact status from logs
  4. If `waiting_for_staffing`: verify staffing and re-create initiative
- **Status**: open (diagnostic logging added; root cause TBD from Worker logs; error visibility in UI tracked in BUG-012)

---

### BUG-012 — Auto-Triggered Work Loop Failure Is Not Surfaced in Initiative UI

- **Area**: Runtime Observability / Dashboard / Initiative Bootstrap
- **Severity**: critical
- **Observed**:
  After creating a fresh initiative, the system auto-triggered the team work loop, but the initiative UI showed no visible result or error.
  Only after manually clicking `Run team_web_product loop` did the UI show:
  `waiting_for_staffing`
  `Task ... is assigned to unavailable runtime employee pm002. Current team runtime roster: none.`
- **Expected**:
  Auto-triggered work loop failures should be visible in the initiative UI after a single page refresh, without requiring the user to manually click the Run button.
  The Task graph section and/or task card should show the loop result message inline.
- **Root Cause (confirmed)**:
  Four separate gaps:
  1. `ctx.waitUntil` error persistence only covered `waiting_for_staffing` and `execution_failed` with a `result.taskId`. `no_pending_tasks` (no taskId) and thrown errors were silently dropped.
  2. Task graph nodes in `renderProductInitiativeDetail` showed title, taskType, status only — `task.errorMessage` was not rendered even when set.
  3. No deferred re-render after initiative creation — the page rendered once before `ctx.waitUntil` finished writing to D1, so `errorMessage` was never visible on first load.
  4. **Scope bug (confirmed at QA build `7f3fad0`)**: `runTeamWorkLoop` selects from ALL pending tasks for the team globally. When multiple projects exist, it picked a task from a different project (`task_07422757`) and wrote the error there — not to the visible task (`task_BK9R87jb`). This left the initiative task graph showing an empty `errorMessage`.
- **Fix Applied**:
  - `routes/projects.ts`: Extended error persistence to all non-success statuses. For statuses with no `taskId`, falls back to `bootstrap.taskIds[0]`. Thrown errors also write to the fallback task.
  - `render.ts`: Task graph nodes now render `task.errorMessage` as a red banner under the status badge. Run buttons are now emitted **per pending task** with a `data-task-id` attribute.
  - `main.ts`: After navigating to the initiative detail on creation, a 3-second deferred `renderRoute()` re-fetches and re-renders, picking up the `error_message` written by `ctx.waitUntil`. Run button handler reads `data-task-id` and passes it to the API.
  - `api.ts`: `runTeamOnce` accepts optional `taskId`; includes it in the POST body.  
  - `lib/team-work-loop.ts`: Added `pinnedTaskId?` parameter. When set, skips the global queue entirely — fetches that single task directly, validates it belongs to the expected company, and proceeds. This guarantees the error is written to the correct task.
  - `routes/team-run.ts`: `TeamRunRequestBody` gains optional `taskId`; `handleRunTeamOnce` passes it as `pinnedTaskId`.
  - `routes/projects.ts`: Bootstrap `ctx.waitUntil` passes `pinnedTaskId: bootstrapCapture.taskIds[0]`.
  - Regression test: `product-visibility-error-message.test.ts` — 22 tests (includes scope isolation: two projects sharing a team; only the pinned project's task receives `errorMessage`).
- **Validation Steps**:
  1. Create initiative when `team_web_product` has no available runtime employee
  2. Do NOT click manual run
  3. Wait ~3 seconds (auto-refresh fires)
  4. Confirm task graph node for the new initiative shows `waiting_for_staffing` message inline
  5. Confirm manual Run button (now per-task, scoped to that task) shows the same result
  6. Confirm no other initiative's tasks show that `errorMessage`
- **Status**: fixed (pending QA — actual staffing fix tracked in BUG-010/BUG-011)