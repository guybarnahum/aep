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

## Dashboard / Frontend Configuration

- Dashboard requires `VITE_CONTROL_PLANE_BASE_URL` and `VITE_OPERATOR_AGENT_BASE_URL` outside local Vite dev.
- Ops console requires `VITE_CONTROL_PLANE_BASE_URL` outside local Vite dev.
- Localhost fallbacks are allowed only for local development builds.
- Deployed builds must fail loudly if required base URL configuration is missing.

## External collaboration adapters

Slack and email are implemented external collaboration adapters. Jira-like
ticket systems are design-only at PR17B.

Canonical AEP state remains in AEP.

External systems may:

- mirror canonical threads/messages
- receive replies/actions
- project task/project/thread visibility
- map external IDs back to canonical AEP IDs

External systems must not:

- own task state
- own project state
- own approvals or escalations
- bypass canonical AEP APIs
- expose private cognition

The code-owned external adapter contract defines:

- external thread projection
- external message projection
- inbound reply contract
- external action contract
- idempotency contract
- policy enforcement contract

Implemented contracts:
- external thread projection: canonical `threadId` + adapter/target -> external thread id
- external message projection: canonical `messageId` + adapter/target -> external message id
- inbound reply correlation: external thread id -> canonical thread -> canonical message
- external action correlation: external action id -> canonical thread/action route
- idempotency: duplicate external messages/actions resolve without duplicate canonical mutation
- policy enforcement: allowed channels, targets, actors, and action/thread compatibility

Jira-like systems must be modeled as ticket projection/collaboration adapters only. Ticket status, comments, and actions reconcile through canonical AEP routes and mapping/audit tables.

Jira-like ticket systems must follow the same adapter model:

- tickets project canonical task/project/thread state
- external ticket IDs map back to canonical AEP IDs
- inbound comments become canonical thread messages
- external status/action changes reconcile through allowed canonical routes
- denied actions are audited and do not mutate canonical state directly

AEP remains the source of truth for work state.

### Slack adapter

Slack is an implemented external collaboration adapter.

Slack may:

- receive mirrored canonical thread/message visibility
- preserve thread continuity through external thread projection maps
- preserve message continuity through external message projection maps
- send inbound replies through `/agent/messages/inbound`
- send allowed approval/escalation actions through `/agent/messages/external-action`

Slack must not:

- own task state
- own project state
- directly mutate approval or escalation state
- bypass canonical AEP action routes
- expose private cognition

Missing Slack configuration is explicit:

- missing routing target config records skipped delivery with `missing_target_config`
- missing `SLACK_MIRROR_WEBHOOK_URL` records skipped delivery with `slack_adapter_not_configured`

### Email adapter

Email is an implemented external collaboration adapter with provider transport
disabled until a real provider is configured.

Email may:

- receive mirrored canonical escalation/thread/message visibility
- preserve thread continuity through external thread projection maps when
	delivery succeeds
- preserve message continuity through external message projection maps when
	delivery succeeds
- send inbound replies through `/agent/messages/inbound`
- send allowed approval/escalation actions through `/agent/messages/external-action`

Email must not:

- own task state
- own project state
- directly mutate approval or escalation state
- bypass canonical AEP action routes
- expose private cognition
- use committed placeholder recipients such as `example.com`

Missing email configuration is explicit:

- missing routing target config records skipped delivery with `missing_target_config`
- disabled provider transport records skipped delivery with `email_adapter_not_configured`
- placeholder recipient targets record skipped delivery with `email_target_invalid`

### Jira-like ticket adapter

Jira-like systems are design-only in PR17E.

A Jira-like system may eventually:

- project canonical projects, tasks, and threads as external tickets
- map external ticket IDs back to canonical AEP IDs
- ingest external comments as canonical thread messages
- request allowed external actions through canonical AEP routes
- surface external ticket URLs for human navigation

A Jira-like system must not:

- own canonical task state
- own canonical project state
- directly set canonical task status
- directly approve or resolve AEP approvals/escalations
- bypass canonical AEP APIs
- expose private cognition

Status reconciliation rule:

- external status changes are signals
- AEP task/project state remains canonical
- `blocked` and `done` should request manager review or create canonical messages
- external status changes must not directly mutate canonical status

PR17E does not add Jira runtime delivery, credentials, webhooks, or tables beyond
design-level contracts.

### External collaboration CI coverage

PR17 external collaboration contracts are guarded by CI.

The coverage includes:

- mirror routing
- external projection mapping
- inbound reply correlation
- external action idempotency
- external action policy enforcement
- skipped delivery when configuration is missing
- placeholder-recipient guardrails
- no adapter ownership of canonical AEP work state

### PR17 final adapter contract

PR17 external collaboration is complete through docs closeout.

Adapter status:

- Slack: implemented and hardened
- email: implemented and hardened, with provider transport disabled until configured
- Jira-like systems: design-only ticket projection adapter

Canonical ownership:

- AEP owns task state
- AEP owns project state
- AEP owns approval/escalation state
- AEP owns private cognition boundaries
- external systems own only their external IDs, surfaces, and delivery context

Mapping/audit surfaces:

- message mirror delivery records
- external thread projection maps
- external message projection maps
- external action records
- external interaction policy/audit records

Allowed external actions must reconcile through canonical AEP routes. Denied or
unsupported actions are policy/audit events, not direct state mutations.

## Hardcoded runtime identifier guardrail

Active runtime, deployed config, and live CI checks must not depend on:

- static employee instance IDs
- committed cleanup tokens
- placeholder live recipients such as `example.com`
- personal `workers.dev` URLs
- implicit internal-org fallback behavior

Historical migrations, documentation, examples, and local-dev-only scripts may contain literals when clearly scoped.

The CI guardrail is:

```bash
npm run ci:no-hardcoded-runtime-identifiers
```

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
- PR14F note: scheduled routing now recognizes a single worker cron (`* * * * *`). Team and manager loops are invoked through interval gating within the worker tick.

### Execution

`POST /agent/run`

- Primary Paperclip/company entrypoint.
- Executes the standard operator-agent routing flow.
- Important invariant: if `/agent/run` receives a `taskId`, that task must already exist.
- Important invariant: executable roles must exist in `roles_catalog`, belong to the employee's team, and have `runtime_enabled = true`.
- Important invariant: execution dispatch is selected from the role's catalog `implementationBinding`, but only through a code-owned allowlisted registry. Unknown or unsupported bindings fail closed.
- Important invariant: runtime authority, budget, and escalation policy are catalog/state-backed and must exist for runtime-enabled roles.

`POST /agent/run-once`

- Direct single-run execution surface.
- Requires query parameter `employeeId`.
- Important invariant: this route must not default to an internal org/team/role when caller scope is omitted.

### Team Loops

`POST /agent/teams/run`

- PR14 team-heartbeat route.
- Runs one bounded team-loop tick across one or more explicit teams.
- Accepts optional JSON body:
	- `companyId`
	- `teamIds`
	- `limit`
- Important invariant: this route must select from canonical tasks and publish canonical thread messages; it must not create a parallel work store.
- Important invariant: callers must provide or resolve real runtime employees through existing employee/role policy surfaces; the route must not depend on hardcoded employee IDs.
- PR14E note: this route is now wired to the internal team-loop library backed by D1 runtime employee and role-policy state.
- PR14H note: when the loop selects canonical work, it records team heartbeat publication status in the response. Heartbeat messages are canonical `coordination` messages linked to the selected task.
- PR16C note: task selection is now specialization-aware and contract-driven. The loop prioritizes canonical ready work first, then team-expected disciplines and canonical task-type order from the task contract registry. Responses and heartbeat payloads include selection metadata (`selection.taskType`, `selection.discipline`, and priority details).

`POST /agent/teams/:teamId/run-once`

- PR14 single-team heartbeat route.
- Runs one bounded loop tick for a single team.
- Accepts optional JSON body:
	- `companyId`
	- `limit`
- Important invariant: if ready work exists but has no executable runtime employee assignment, the route must return a waiting state and publish that state canonically instead of inventing hidden staffing.
- PR14C/D staffing note: internal team-loop resolution already returns explicit waiting-for-staffing results when a team has ready work but no executable runtime employee. No seeded or hardcoded employee IDs are allowed in that path.
- PR14H note: execution failures are returned as bounded `execution_failed` team-loop results and are published as canonical heartbeat messages when an author can be resolved from the task or selected employee.
- PR16C note: single-team loop responses include specialization selection metadata for the chosen canonical task, and published team heartbeat messages carry the same selection details.
- PR16D note: team-loop scheduling now invokes bounded cognition for candidate prioritization and public rationale generation. When cognition recommends `request_manager_review`, the loop publishes a canonical scheduling review thread and returns `manager_review_requested` without preempting work automatically.
- PR16E note: task contracts define expected artifact types and task detail now reports `artifactExpectations` derived from those contracts. This remains soft validation (visibility only), and team heartbeat payloads may include artifact expectation status after execution or failure.

`GET /agent/scheduler-status`

- Returns scheduler mode visibility plus effective team/manager loop cadence.
- Effective cadence is resolved from canonical operator-agent scheduler state persisted in D1 when available.
- On first boot, when no canonical scheduler row exists, that persisted state is seeded from the deployed env defaults:
- `AEP_TEAM_TICK_INTERVAL_MINUTES`
- `AEP_MANAGER_TICK_INTERVAL_MINUTES`
- Legacy `30/60` migration seed rows with no updater are normalized to deployed env defaults by runtime initialization.
- No separate cron registrations exist for team or manager loops.

`POST /agent/scheduler-status`

- Updates persisted team and manager loop cadence.
- Accepts JSON body:
	- `teamTickIntervalMinutes`
	- `managerTickIntervalMinutes`
	- `updatedBy`
	- optional `expectedUpdatedAt`
- Important invariant: cadence updates must remain bounded integer minute intervals (`1..60`) and must update canonical backend state rather than dashboard-local state.
- Important invariant: non-integer values, missing updater identity, and out-of-range values are rejected.
- Important invariant: when `expectedUpdatedAt` is provided and no longer matches canonical state, the route returns `409` and the caller must reload before saving again.

### Intake Requests

`POST /agent/intake`

- Create a new intake request.
- Required fields:
	- `companyId`
	- `title`
	- `requestedBy`
	- `source`
- Status is always initialized to `submitted`.

`GET /agent/intake`

- List intake requests.
- Optional query:
	- `companyId`

`GET /agent/intake/:id`

- Fetch a single intake request.

`PATCH /agent/intake/:id`

- Update the status of an intake request.
- Required body fields:
	- `status` — one of `submitted`, `triaged`, `converted`, `rejected`
- Returns the updated intake request.

`POST /agent/intake/:id/convert-to-project`

- Convert an intake request into a canonical project.
- Accepts JSON body:
	- `convertedByEmployeeId` (required)
	- optional `ownerTeamId` (defaults to web-product team)
	- optional `projectTitle` (defaults to intake title)
	- optional `projectDescription` (defaults to intake description)
	- optional `rationale`
- Creates a project (status `active`) linked to the intake.
- Marks the intake status as `converted`.
- Creates a coordination message thread and an initial system note.
- Returns `{ ok, intake, project, threadId, messageId }` with a `201` status.
- Returns `409` if the intake has already been converted.
- Returns `422` if the intake has been rejected.

Important invariants:

- Intake does NOT create tasks.
- Intake is a demand signal only.
- Triage sets status to `triaged`; rejection sets status to `rejected`.
- Conversion is the only operation that creates a project from an intake.
- A converted intake cannot be converted again.
- Conversion requires a real employee author and publishes only public coordination rationale.
- Conversion does not expose private PM cognition.

### Projects

`POST /agent/projects`

- Create a canonical project.
- Required fields:
	- `companyId`
	- `title`
	- `ownerTeamId`
- Optional fields:
	- `createdByEmployeeId`
	- `description`
	- `intakeRequestId`
- Status is initialized to `active`.
- If `intakeRequestId` is supplied, it must exist and belong to the same company.

`GET /agent/projects`

- List canonical projects.
- Optional query:
	- `companyId`
	- `ownerTeamId`
	- `status`
	- `intakeRequestId`
	- `limit`

`GET /agent/projects/:id`

- Fetch one canonical project.

`POST /agent/projects/:id/task-graph`

- Create a canonical task graph for an active project.
- Required body fields:
	- `createdByEmployeeId`
	- `tasks`
- Optional body fields:
	- `rationale`
- Each task requires:
	- `clientTaskId`
	- `title`
	- `taskType`
	- `assignedTeamId`
- Each task may include:
	- `ownerEmployeeId`
	- `assignedEmployeeId`
	- `payload`
	- `dependsOnClientTaskIds`
- Creates canonical tasks using the existing task store and task dependency model.
- Links every created task to the project through task payload:
	- `projectId`
	- `intakeRequestId`
	- `projectTaskClientId`
- Creates an org-visible coordination thread/message summarizing the graph creation.

Important invariants:

- Projects do NOT execute work directly.
- Projects can be created directly via `POST /agent/projects` or via intake conversion (`POST /agent/intake/:id/convert-to-project`).
- Projects are containers for PM-created task graphs.
- Task graph creation must use canonical tasks and dependencies only.
- No parallel project-work store is introduced.
- PR15D task graph creation does not expose private PM cognition; only public coordination rationale may be published.
- PR15F CI validates the complete intake -> project -> task graph flow against deployed operator-agent routes, including negative cases for double conversion, invalid team ownership, and unknown task dependencies.
- PR15G docs closeout note: the canonical work-entry model is now intake -> project -> task graph -> team loop execution. Endpoint docs should preserve that separation and avoid describing intake or projects as execution surfaces.

### Roles And Employees

`GET /agent/roles`

- Lists public role contracts from `roles_catalog`.
- Includes canonical job-description fields, runtime metadata (`employeeIdCode`, `runtimeEnabled`, `implementationBinding`, `managerRoleId`), and optional `reviewDimensions` used by dashboard role detail and employee-review forms.
- Important invariant: role-level prompt scaffolding remains private and is not exposed through this route.
- Live-selection note: CI capability-based employee resolution may use this route as role metadata input when a caller needs to select an employee by expected role behavior instead of by seeded identity.

### HR / Staffing Inventory

PR18A inventory status:

- Existing employee catalog, employee lifecycle, persona, and review routes are canonical AEP routes.
- Employee creation already flows through `POST /agent/employees`.
- Employee lifecycle changes already flow through explicit `/agent/employees/:employeeId/...` action routes.
- Review cycles and employee reviews already exist as canonical governance/evidence surfaces.
- Staffing-specific contracts are not implemented yet.

Implemented staffing routes:

- `GET /agent/staffing/role-gaps`
	- Computes advisory role gaps.
	- Does not mutate employee, task, project, approval, or staffing state.
	- Returns `advisoryOnly: true`.
	- Detects roles with no active employees, task impact from missing role capacity, and inactive/on-leave impact.

Missing staffing routes:

- no `GET /agent/staffing/requests`
- no `POST /agent/staffing/requests`
- no hiring request approval/fulfillment route
- no hiring recommendation route

Missing staffing contracts:

- `JobDescription` - now code-owned in PR18B; no public route yet
- `StaffingRequest` - now code-owned in PR18B; no public route yet
- `HiringRecommendation` - now code-owned in PR18B; no public route yet
- `RoleGap` - now code-owned in PR18B; no public route yet

Canonical boundary:

- UI may display staffing state and trigger canonical actions only.
- HR/staffing must not directly mutate employee state outside employee creation and lifecycle routes.
- Staffing must not introduce a parallel HR database outside canonical AEP tables.
- Hiring must not auto-create employees without approval and canonical audit linkage.
- PR18B defines the staffing contracts in code only. Runtime API surfaces begin in later PR18 stages.

### Runtime Role Policies

`GET /agent/runtime-role-policies`

- Lists runtime authority, budget, and escalation policy by role.
- Intended for operator visibility and dashboard editing.

`GET /agent/runtime-role-policies/:roleId`

- Returns the runtime policy for one role.

`PATCH /agent/runtime-role-policies/:roleId`

- Updates authority, budget, and/or escalation policy for a runtime-enabled role.
- Rejects unknown roles and roles that are not `runtime_enabled`.
- Validates JSON shape, supported operator actions, supported escalation actions, and non-negative budget values.
- Does not allow editing implementation bindings; implementation dispatch remains code-owned and allowlisted.

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
- Important invariant: runtime authority, budget, and escalation policy are D1-backed role policy state, while live runtime employee instances are resolved from D1 by company, team, and role intent. CI checks that exercise live runtime behavior should discover employee IDs from `/agent/employees` instead of assuming a seeded instance ID.
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

- Returns recent manager decisions for a specific manager employee.
- `managerEmployeeId` is required.
- Important invariant: this route must not default to an internal org/team/role when caller scope is omitted.

Dashboard note:

- dashboard callers should resolve live employee IDs from `/agent/employees` by role/team intent before calling this route

`GET /agent/work-log`

- Returns recent work log entries for a specific employee.
- `employeeId` is required.
- Important invariant: this route must not default to an internal org/team/role when caller scope is omitted.

Dashboard note:

- dashboard callers should resolve live employee IDs from `/agent/employees` by role/team intent before calling this route

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

Task creation validates `taskType` through the canonical AEP task contract registry.

Canonical task state stores only PR16 task types:

- PM: `project_planning`, `requirements_definition`, `task_graph_planning`
- Web: `web_design`, `web_implementation`, `ui_iteration`
- Infra: `deployment`, `monitoring_setup`, `incident_response`
- Validation: `test_execution`, `bug_report`, `verification`
- Cross-cutting: `coordination`, `analysis`

Legacy PR15 task type aliases are accepted at API/task-creation boundaries
and normalized before persistence:

- `plan-website-delivery` -> `task_graph_planning`
- `plan-feature` -> `task_graph_planning`
- `website-design` -> `web_design`
- `website-implementation` -> `web_implementation`
- `implementation` -> `web_implementation`
- `website-deployment` -> `deployment`
- `validate-deployment` -> `verification`

The task contract registry also carries team-discipline, default role, and
artifact-expectation metadata for PR16B-F. It must remain code-owned and must
not become a dashboard-owned state store.

PR16B note: task creation also validates payload shape through the same
task contract registry. Required payload fields are enforced at canonical
task creation time, before persistence. This applies equally to direct task
creation, project task graphs, thread delegation, and agent-created tasks.

Examples:

- `web_implementation` requires `targetUrl` and `requirementsRef`
- `deployment` requires `environment` and `artifactRef`
- `verification` requires `targetUrl` and `subjectRef`
- `bug_report` requires `sourceTaskId` and `summary`

PR16D scheduling and parking note:

- Canonical task status includes `parked` for manager-mediated preemption decisions.
- Parking is explicit, auditable, and route-mediated.
- Team loops may return `manager_review_requested` when cognition identifies scheduling tradeoffs that require manager approval.

PR16F delegation note:

- Task contracts define allowed next-task delegation patterns.
- Delegation creates normal canonical tasks with dependency/provenance links.
- Invalid delegation edges are rejected at the task delegation boundary.
- Slack/email/UI remain adapters only and do not own delegation state.

PR16G closeout note:

- PR16 role realism is guarded by an umbrella contract check:
	`npm run ci:pr16-role-realism-contract-check`
- The check verifies task contracts, payload contracts, artifact expectations,
	parked task state, cognitive scheduling, delegation route wiring, and PR16
	CI script registration.
- PR16 behavior remains inside canonical AEP primitives and does not introduce
	scheduler tables, delegation tables, or team-specific work stores.

`GET /agent/tasks`

- Lists canonical coordination tasks.

`POST /agent/tasks`

- Creates a canonical task.

`GET /agent/tasks/:taskId`

- Returns task detail.
- Includes `artifactExpectations`, derived from the task contract registry and currently enforced as soft visibility.

`POST /agent/tasks/:taskId/park`

- Manager-mediated task preemption endpoint.
- Required JSON body fields:
	- `parkedByEmployeeId`
	- `reason`
	- `managerDecisionId`
- Applies canonical task status transition to `parked`.
- Persists a canonical coordination audit thread/message linked to the parked task.

`POST /agent/tasks/:taskId/delegate`

- Creates a delegated canonical task from an existing source task.
- Required JSON body fields:
	- `delegatedByEmployeeId`
	- `taskType`
	- `title`
- Optional JSON body fields:
	- `assignedTeamId`
	- `payload`
	- `dependsOnSourceTask`
- Delegation is validated against the source task's task contract.
- Delegated tasks receive canonical provenance in payload:
	- `sourceTaskId`
	- `sourceTaskType`
	- `delegatedByEmployeeId`
	- inherited `projectId` / `intakeRequestId` when available
- Creates a canonical coordination thread/message recording the delegation.
- Does not introduce a separate delegation/work store.

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

`GET /validation/overview`

`GET /validation/scheduler`

`GET /validation/employees`

`GET /validation/employees/:employeeId`

`GET /validation/dispatch`

`POST /validation/dispatch`

`POST /validation/run-now`

`POST /validation/scheduler/pause`

`POST /validation/scheduler/resume`

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
- recurring scheduler pause/resume state is persisted in `validation_scheduler_state`
- paused recurring validation skips cron-driven execution, while `POST /validation/run-now` still allows explicit manual execution and records an internal manual execution target

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