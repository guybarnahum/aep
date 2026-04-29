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
* **Validation Steps**:

  1. Create new initiative
  2. Observe task states
  3. Confirm at least one task transitions to running/completed
* **Status**: open

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
- **Validation Steps**:
  1. Create initiative
  2. Create human intervention
  3. Confirm ready tasks transition beyond `ready`
  4. Confirm artifacts are produced downstream
- **Status**: open

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
