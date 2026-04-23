# API — Endpoint Reference

This document is the canonical endpoint reference for AEP HTTP surfaces.

Scope:

- operator-agent runtime endpoints
- control-plane read, workflow, and validation endpoints
- endpoint-specific invariants that were previously scattered across repo docs

Notes:

- test-only routes are explicitly marked
- route implementation remains the source of truth
- architecture and product rationale stay in package README files and in `LLM.md`

## Operator Agent

Base service: `core/operator-agent`

### System

`GET /healthz`

- Liveness/readiness health surface for the worker.

`GET /build-info`

- Build metadata for the deployed operator-agent runtime.

`POST /__scheduled`

- Test-only scheduled trigger shim.
- Only available when `ENABLE_TEST_ENDPOINTS === "true"`.

### Execution

`POST /agent/run`

- Primary Paperclip/company entrypoint.
- Executes the standard operator-agent routing flow.
- Important invariant: if `/agent/run` receives a `taskId`, that task must already exist.
- Important invariant: executable roles must exist in `roles_catalog`, belong to the employee's team, and have `runtime_enabled = true`.
- Important invariant: execution dispatch is selected from the role's catalog `implementationBinding`, but only through a code-owned allowlisted registry. Unknown or unsupported bindings fail closed.

`POST /agent/run-once`

- Direct single-run execution surface.

`GET /agent/scheduler-status`

- Returns scheduler mode visibility such as `primaryScheduler` and `cronFallbackEnabled`.

### Roles And Employees

`GET /agent/roles`

- Lists public role contracts from `roles_catalog`.
- Includes canonical job-description fields, runtime metadata (`employeeIdCode`, `runtimeEnabled`, `implementationBinding`, `managerRoleId`), and optional `reviewDimensions` used by dashboard role detail and employee-review forms.
- Important invariant: role-level prompt scaffolding remains private and is not exposed through this route.
- Live-selection note: CI capability-based employee resolution may use this route as role metadata input when a caller needs to select an employee by expected role behavior instead of by seeded identity.

`GET /agent/employees`

- Lists employees.
- Supports filters such as `status`, `teamId`, and `employmentStatus`.
- This route is the canonical discovery surface for live employee instance resolution in CI and runtime-adjacent validation.
- Checks that exercise live operator-agent behavior should resolve current employees by role/team intent from this route rather than assuming a fixed seeded employee id.
- Capability-based CI selection note: the shared CI resolver now supports semantic matching over this route by combining role/team/runtime discovery with explicit required properties. Callers should prefer required capability filters such as expected scope bindings or role metadata over seeded-id assumptions.
- Important dashboard contract: employee projections include separate `employment` and `runtime` blocks plus public-profile fields, public links, and optional visual identity.

`POST /agent/employees`

- Creates a draft or active employee record with public profile fields and lifecycle metadata.
- Supports synthetic employee creation for CI/test fixtures through `isSynthetic`.
- Important invariant: when `employeeId` is omitted, the operator-agent derives the new employee ID from `roles_catalog.employee_id_code` using the canonical `<two-letter-code><3-digit-sequence>` format (for example `qa001`, `pm001`, `dv001`).
- Important invariant: runtime authority and budget are owned by role profiles in code, but live runtime employee instances are resolved from D1 by company, team, and role intent. CI checks that exercise live runtime behavior should discover employee IDs from `/agent/employees` instead of assuming a seeded instance ID.
- This is the dashboard hiring / staffing creation surface.

`PATCH /agent/employees/:employeeId`

- Updates employee public/profile and scheduling fields.
- This is the dashboard employee-profile management surface.

`GET /agent/employees/:employeeId/scope`

- Returns resolved scope bindings for an employee.
- CI capability-selection note: this is the canonical surface for selectors such as `required.scope.allowedServices`, `required.scope.allowedTenants`, and `required.scope.allowedEnvironmentNames` when checks need the employee with a specific live scope shape, such as dashboard preview or async-validation coverage.

`GET /agent/employees/:employeeId/effective-policy`

- Returns effective authority, budget, control state, and implementation status.
- CI capability-selection note: this route is available to higher-order selectors when a caller needs to choose an employee by effective runtime behavior instead of identity.

`GET /agent/employees/:employeeId/employment-events`

- Returns lifecycle event history for the employee.

`GET /agent/review-cycles`

- Lists canonical employee review cycles.
- Used by the dashboard people-management and employee-review surfaces.

`POST /agent/review-cycles`

- Creates a canonical review cycle with `name`, `periodStart`, `periodEnd`, and optional `status` / `createdBy`.

`GET /agent/employees/:employeeId/reviews`

- Lists evidence-linked performance reviews for the employee.

`POST /agent/employees/:employeeId/reviews`

- Creates an evidence-linked employee performance review.
- Important invariant: submitted `dimensionScores` keys must match the selected role's canonical `reviewDimensions`.
- Important invariant: employee employment status must be one of `active`, `on_leave`, `retired`, or `terminated`.
- Important invariant: the referenced review cycle must exist and be `active`.
- Important invariant: at least one dimension score, one recommendation, and one evidence item are required.
- Important invariant: each dimension score must be in the range `1..5`.
- Important invariant: evidence items must reference canonical `task`, `artifact`, or `thread` ids that actually exist.
- Important invariant: `approvedBy` is required for high-impact recommendations (`promote`, `reassign`, `restrict`).

`POST /agent/employees/:employeeId/generate-persona`

- Generates a public persona profile and draft prompt profile from role contract plus description input.

Role cognition note:

- runtime cognition assembly may combine public role-contract context with private role-level and employee-level prompt scaffolds plus bounded policy/task context
- these private scaffolds remain internal and are not exposed by any public route
- CI behavior-selection note: callers that need to select an employee by observed rationale or cognition behavior should use existing public task, artifact, thread, scope, policy, and role surfaces through the shared resolver's `required.matchCandidate` hook rather than reading prompt-profile tables directly.

`POST /agent/employees/:employeeId/approve-persona`

- Approves the employee prompt profile previously generated or drafted.

### Employee Lifecycle Actions

`POST /agent/employees/:employeeId/activate`

`POST /agent/employees/:employeeId/reassign-team`

`POST /agent/employees/:employeeId/change-role`

`POST /agent/employees/:employeeId/start-leave`

`POST /agent/employees/:employeeId/end-leave`

`POST /agent/employees/:employeeId/retire`

`POST /agent/employees/:employeeId/terminate`

`POST /agent/employees/:employeeId/rehire`

`POST /agent/employees/:employeeId/archive`

- Apply explicit employment lifecycle transitions.
- These mutate employment state, team assignment, or role assignment depending on action.
- Dashboard-facing flow note: these routes are the canonical write path for leave, reassignment, role change, retirement, termination, rehire, and archive operations. They must not be bypassed by direct catalog writes.

### Controls, Governance, And Audit

`GET /agent/employee-controls`

- Lists employee control records and effective runtime control state.

`GET /agent/manager-log`

- Lists supervisory decisions.

`GET /agent/control-history`

- Lists runtime control transition history.
- Supports employee-scoped audit reads.

`GET /agent/roadmaps`

- Lists team roadmap rows from `team_roadmaps`.

### Escalations

`GET /agent/escalations`

- Lists escalations.
- Supports filtering such as `state` and `limit`.

`GET /agent/escalations/:escalationId`

- Returns escalation detail.

`POST /agent/escalations/acknowledge`

- Explicitly acknowledges an escalation.

`POST /agent/escalations/resolve`

- Explicitly resolves an escalation.

### Approvals

`GET /agent/approvals`

- Lists approvals.

`GET /agent/approvals/:approvalId`

- Returns approval detail.

`POST /agent/approvals/approve`

- Approves an approval record.

`POST /agent/approvals/reject`

- Rejects an approval record.

### Tasks

`GET /agent/tasks`

- Lists canonical coordination tasks.

`POST /agent/tasks`

- Creates a canonical task.

`GET /agent/tasks/:taskId`

- Returns task detail.

`GET /agent/tasks/:taskId/artifacts`

- Lists artifacts linked to a task.

`POST /agent/tasks/:taskId/artifacts`

- Creates a task artifact.

### Messages And Threads

`GET /agent/messages`

- Lists canonical messages.

`POST /agent/messages`

- Creates a canonical message.
- Important invariant: human-authored dashboard messages are sent through canonical `/agent/messages`.

`POST /agent/messages/inbound`

- Ingests inbound external replies.

`POST /agent/messages/external-action`

- Applies explicit external actions.

`GET /agent/message-threads`

- Lists canonical message threads.

`POST /agent/message-threads`

- Creates a canonical message thread.

`GET /agent/message-threads/:threadId`

- Returns thread detail.

`POST /agent/message-threads/:threadId/approve`

- Approval action routed through a thread.

`POST /agent/message-threads/:threadId/reject`

- Reject action routed through a thread.

`POST /agent/message-threads/:threadId/acknowledge-escalation`

- Escalation acknowledge action routed through a thread.

`POST /agent/message-threads/:threadId/resolve-escalation`

- Escalation resolve action routed through a thread.

`POST /agent/message-threads/:threadId/delegate-task`

- Creates a task from a canonical thread with durable provenance.

`GET /agent/inbox/:employeeId`

- Lists inbox messages for an employee.

`GET /agent/outbox/:employeeId`

- Lists outbox messages for an employee.

### Work Log

`GET /agent/work-log`

- Lists operator work log entries.

### Test-Only Operator-Agent Endpoints

The following must not be assumed by reusable validation workflows unless explicitly enabled.

`POST /agent/te/seed-approval`

`POST /agent/te/seed-work-log`

`POST /agent/te/purge-employee`

- Purges a synthetic employee fixture by `employeeId`.
- Important invariant: only employees with `is_synthetic = 1` may be purged.
- Important invariant: purge is only allowed when `employment_status = archived`.
- Authorization rule: purge is allowed only when `ENABLE_TEST_ENDPOINTS === "true"`.
- This is not a normal product lifecycle route and must not be used for real employees.

`POST /agent/work-log/seed`

Guidance:

- reusable validation lanes must avoid assuming test-only `/agent/te/...` endpoints exist
- prefer live state where possible
- soft-skip cleanly when environment-specific setup is absent
- synthetic employee creation and purge belong only in async-validation or other explicitly test-enabled environments

## Control Plane

Base service: `core/control-plane`

### System

`GET /health`

`GET /healthz`

- Health surfaces.

### Runs And Trace

`GET /runs`

`GET /runs/:runId`

`GET /runs/:runId/jobs`

`GET /runs/:runId/summary`

`GET /runs/:runId/failure`

`GET /trace/:traceId`

### Organization Catalog

`GET /companies`

`GET /companies/:companyId`

`GET /teams`

`GET /teams/:teamId`

`GET /teams/:teamId/ownership`

`GET /org/tenants`

`GET /org/tenants/:tenantId`

`GET /org/tenants/:tenantId/environments`

`GET /services`

`GET /services/:serviceId`

`GET /employees`

`GET /employees/:employeeId`

`GET /employees/:employeeId/scope`

`GET /tenants`

`GET /tenants/:tenantId`

`GET /tenants/:tenantId/services`

`GET /tenants/:tenantId/services/:serviceId`

### Validation Surfaces

`GET /validation`

`GET /validation/employees`

`GET /validation/employees/:employeeId`

`GET /validation/dispatch`

`POST /validation/dispatch`

`POST /validation/dispatch/schedule-post-deploy`

`POST /validation/dispatch/schedule-recurring`

`POST /validation/dispatch/:dispatchId/execute`

`POST /validation/results/:resultId/audit`

`GET /validation/results`

`GET /validation/results/latest`

`GET /validation/results/:resultId`

`GET /validation/verdict`

`GET /validation/policy`

Recurring validation note:

- cron-driven recurring validation runs directly inside the control-plane and records an internal recurring-validation execution target instead of depending on an environment-specific HTTP base URL

`GET /validation/runs`

`POST /validation/runs`

`GET /validation/runs/:runId`

`POST /validation/runs/:runId/execute`

### Workflow And Operator Actions

`POST /operator/*`

- Operator control-plane action surface.

`POST /workflow/start`

- Starts a workflow.

`GET /workflow/:workflowRunId`

- Reads workflow state.

`POST /workflow/:workflowRunId/cancel`

- Cancels a workflow run.

### Internal/Test Control-Plane Endpoints

`POST /internal/deploy-job-attempts/:attemptId/callback`

`POST /internal/test/deploy-jobs/:jobId/advance-timeout`

`POST /internal/test/deploy-jobs/:jobId/supersede`

`GET /debug/deploy-jobs/:jobId`

These are internal or test-focused and should not be treated as product-facing API surfaces.