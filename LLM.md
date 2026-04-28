# AEP — System State, Canonical Architecture, and Next Work

Repository (source of truth):  
👉 https://github.com/guybarnahum/aep

The repository code is the source of truth.  
This document is aligned to commit `6e6b82dfc34c19e5f0851f5928731a41e756446b`.
This document has been updated for PR21A planning after baseline `bed9a59da43a7e9467d22af702a52303eaeca8d1`.

Endpoint documentation note for future LLM sessions:

- HTTP endpoint documentation is centralized in `API.md` at this commit
- treat `API.md` as the canonical API reference before inferring routes from scattered docs
- if the repo later renames `API.md` or `APII.md`, use that renamed file as the same canonical API reference
- use `LLM.md` for architecture, continuity, and task context; use `API.md` for concrete route surfaces and invariants
- runtime-facing checks should resolve live employee instances from `/agent/employees` by role/team intent instead of assuming seeded employee ids
- UI and CI should resolve employee IDs for explicit-scope runtime routes such as `/agent/run-once`, `/agent/work-log`, and `/agent/manager-log` from `/agent/employees` by role/team intent before calling them; those routes must not invent internal scope defaults
- role metadata such as `runtime_enabled`, `implementation_binding`, and `manager_role_id` belongs in `roles_catalog`, while runtime authority, budget, and escalation policy belong in D1-backed `runtime_role_policies`; executable code selection still remains code-owned and allowlisted through implementation binding registry resolution
- dashboard editing of runtime role policy is allowed only through validated runtime-policy APIs
- runtime policy editing must not expose implementation binding editing or dynamic executable dispatch
- invalid policy shapes must fail closed before persistence
- CI live employee resolution should prefer semantic requirements over seeded-identity assumptions: use role/team/runtime as the initial candidate set, then filter by required scope properties, expected role metadata, or explicit behavior-based matchers as needed
- schema and surface checks should prefer role-oriented invariants over seeded-id assertions where practical
- `scripts/ci/shared/employee-ids.ts` must not exist; CI checks should resolve live employee ids by role/team from `/agent/employees` or use local fixture ids only for pure unit-style checks that do not depend on seeded runtime employees
- staging and production contracts validation must not create synthetic employees
- synthetic employee lifecycle/persona mutation checks belong only in the async-validation lane
- runtime role policy mutation-and-revert contract checks belong only in the async-validation lane
- async-validation may enable `ENABLE_TEST_ENDPOINTS=true` and purge synthetic employees after mutation checks complete
- recurring validation should not depend on an environment-specific base URL when the control-plane can execute the validation batch directly
- internal recurring validation should record an internal execution target marker rather than a deployed HTTP URL
- recurring validation scheduler state now lives in D1 and may be paused/resumed from canonical control-plane routes and the dashboard validation surface
- dashboard and ops-console may use localhost defaults only in Vite local-dev builds
- deployed frontend builds must require explicit public base URL configuration
- missing deployed frontend URL config should fail loudly rather than silently pointing at localhost
- Slack and email are adapters only; AEP canonical state remains the source of truth for tasks, approvals, escalations, canonical message threads, evidence, and rationale
- mirroring uses three layers: secrets such as `SLACK_MIRROR_WEBHOOK_URL`, per-environment delivery targets such as `MIRROR_DEFAULT_SLACK_CHANNEL` and `MIRROR_ESCALATIONS_EMAIL_GROUP`, and D1-backed routing policy that maps canonical context to logical target keys
- do not commit placeholder live recipients such as `example.com`
- missing delivery config should disable that delivery path and record a skipped-delivery reason
- CI must enforce the hardcoded runtime identifier guardrail. Active runtime/config/CI code must not reintroduce static employee IDs, committed cleanup tokens, placeholder live recipients, personal workers.dev URLs, or implicit internal-org default routing. Historical migrations, docs, examples, and local-dev-only scripts may contain literal examples when clearly scoped.
- CI post-deploy validation is gated by ordered validation levels: smoke (0) = production-safe reads only; mutating (1) = staging-safe writes that create CI-marked records; full (2) = preview integration including messaging/mirror/external-action checks; destructive (3) = async-validation-only checks that mutate synthetic state. Levels are strictly ordered: destructive includes all lower levels.
- All canonical records created by live scenario checks must be tagged with `ciActor(CHECK_NAME)` as `createdByEmployeeId` and `...ciArtifactMarker(CHECK_NAME)` spread into the payload. This enables the `POST /agent/te/purge-ci-artifacts` endpoint to clean them up by run ID after staging validation completes.
- The `CI_CLEANUP_TOKEN` environment secret controls access to the purge endpoint; it must never be committed as a plaintext value. The placeholder `""` in `wrangler.jsonc` must be overridden by a Cloudflare secret before staging or preview deployments use the cleanup path.
- Validation scripts in `scripts/ci/shared/ci-artifacts.ts` provide `ciRunId()`, `ciActor(checkName)`, and `ciArtifactMarker(checkName)`. All new live scenario checks that create records must import these helpers.
- PR15A-F are complete in code: AEP now has canonical intake requests, canonical projects, intake-to-project conversion, project-to-task-graph creation, dashboard UI, and deployed CI scenario coverage for the intake -> project -> task graph flow.
- PR16A begins role realism by adding a native task contract registry. Task types are no longer arbitrary strings: they resolve through code-owned task contracts that define canonical task type, discipline, expected teams, expected artifacts, legacy aliases, and default role hints. Legacy PR15 task aliases are accepted only at creation boundaries and normalized before persistence, so canonical task state uses PR16 vocabulary only.
- PR16B extends the same task contract registry with payload contracts. Task payload requirements are validated at the canonical task-store creation boundary before persistence, so direct route creation, project task graphs, thread delegation, and agent-created work all share one contract path. This keeps specialization inside the existing task/artifact/thread model instead of introducing team-specific stores.
- PR16C adds team-loop specialization on top of canonical task contracts. Team loop task picking is now role/discipline aware and ordered by contract-defined canonical task-type priority, while remaining in the same canonical task store and scheduler flow. Team loop responses and heartbeat payloads now expose specialization selection metadata.
- PR16 is complete through PR16G. PR16 moved AEP from generic task execution toward role-realistic organizational behavior:
  - PR16A - native task contract taxonomy
  - PR16B - task payload contracts
  - PR16C - team-loop specialization
  - PR16D - cognitive prioritization and manager-mediated parking
  - PR16E - artifact expectations and live scheduling/parking coverage
  - PR16F - contract-driven delegation patterns
  - PR16G - integrated CI and documentation closeout
- PR16D introduces cognitive prioritization and manager-mediated parking while preserving canonical state boundaries. Code gathers safe candidates and enforces contracts; cognition ranks, recommends, and explains tradeoffs through public rationale.

  ### PR16E - Artifact Expectations + Live Scheduling Coverage

  PR16E makes task output expectations visible and auditable without adding new state.
  Expected artifact types remain defined in the task contract registry. Task detail
  responses evaluate whether the task has produced expected artifacts and expose a
  soft `artifactExpectations` block.

  This is intentionally soft enforcement:

  - missing expected artifacts are visible
  - CI can assert expectations
  - execution is not blocked yet

  PR16E also adds live scenario coverage for PR16D cognitive scheduling and
  manager-mediated parking, because source-level checks alone are not sufficient
  for the organization-runtime contract.

### PR16F - Delegation Patterns

PR16F makes delegation contract-driven. Task contracts define allowed follow-up
task types, and delegation creates ordinary canonical tasks with provenance.

Delegation invariants:

- no delegation tables
- no team-specific work stores
- no dashboard-owned delegation state
- source task remains canonical
- delegated task is a normal task
- provenance is stored in task payload and coordination thread/message

Example delegation edges:

```text
PM planning -> Web design / Web implementation
Web implementation -> Infra deployment
Infra deployment -> Validation verification
Validation verification -> Bug report / Coordination
Bug report -> PM/Web/Infra follow-up
```

Delegation is organizational behavior over canonical tasks, not a new workflow
engine.

### PR16G - Role Realism Closeout

PR16G closes the role-realism stage by adding an umbrella CI guard and aligning
docs around the final PR16 model.

PR16 final state:

```text
task contract
  -> task type
  -> payload contract
  -> team/discipline expectation
  -> artifact expectation
  -> delegation pattern
  -> cognitive scheduling context
```

Important invariant:

> Code constrains structure. Cognition exercises bounded judgment.

PR16 does not add:

- scheduler tables
- delegation tables
- project-work tables
- team-specific work stores
- dashboard-owned state

All PR16 behavior remains inside:

- tasks
- task dependencies
- artifacts
- threads/messages
- approvals/escalations
- projects/intake links
- manager/audit surfaces

The umbrella CI check is:

```bash
npm run ci:role-realism-contract-check
```

It verifies the integrated PR16 contract surface: task contracts, payload
contracts, parked state, cognitive scheduling, artifact expectations,
delegation route wiring, and PR16 live/contract CI script registration.

### PR17B - Canonical External Collaboration Contract

PR17B makes external collaboration a code-owned contract instead of a set of
implicit adapter behaviors.

The contract defines:

- supported adapter identities: Slack, email, and Jira-like systems
- supported collaboration surfaces:
  - external thread projection
  - external message projection
  - inbound reply ingestion
  - external action ingestion
  - Jira-like ticket projection
- canonical resources that may be projected
- idempotency keys
- policy enforcement points
- denied adapter capabilities

Implemented:
- Slack/email outbound mirroring
- mirror routing policy
- skipped delivery records when delivery config is missing
- external thread projection mapping
- external message projection mapping
- inbound reply correlation
- external action records
- external interaction policy/audit
- external approval/escalation action routing

Implemented in PR22 (mirror-only):
- Jira-like ticket projection and ingest adapter

Canonical invariant:

> External systems are projection and collaboration surfaces. AEP owns work state.

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

PR17B adds the CI guard:

```bash
npm run ci:external-collaboration-contract-check
```

The check verifies that Slack, email, and Jira-like systems have explicit
contracts, that all adapters deny canonical state ownership, that Jira remains
mirror-only (never a canonical work-state owner), and that existing
mirror/inbound/action/policy wiring remains in place.

### PR17C - Slack Adapter Hardening

PR17C hardens Slack as a production-shaped collaboration adapter while
preserving AEP as the source of truth.

Slack behavior remains adapter-only:

- outbound Slack messages mirror canonical AEP messages
- Slack thread continuity is represented through external thread projection maps
- Slack message continuity is represented through external message projection maps
- inbound Slack replies correlate back to canonical AEP threads
- Slack approval/escalation actions reconcile through canonical action routes
- missing Slack delivery configuration records skipped delivery, not hidden failure
- Slack never owns task, project, approval, escalation, or cognition state

Slack transport hardening:

- Slack webhook payload construction is explicit and testable
- valid Slack timestamps may be sent as `thread_ts`
- synthetic AEP external thread ids are never sent as Slack `thread_ts`
- missing `SLACK_MIRROR_WEBHOOK_URL` produces an observable skipped delivery

PR17C adds the CI guard:

```bash
npm run ci:slack-adapter-contract-check
```

This check verifies Slack payload construction, missing-webhook skip behavior,
and the invariant that skipped Slack delivery does not create external
projection records.

### PR17D - Email Adapter Hardening

PR17D brings the email adapter to the same conceptual model as Slack while
keeping provider delivery disabled until a real email transport is configured.

Email behavior remains adapter-only:

- outbound email mirrors canonical AEP messages
- email thread continuity is represented through external thread projection maps
  only after successful delivery
- email message continuity is represented through external message projection
  maps only after successful delivery
- inbound email replies correlate back to canonical AEP threads
- email approval/escalation actions reconcile through canonical action routes
- missing email delivery configuration records skipped delivery, not hidden failure
- placeholder recipients such as `example.com` are rejected
- email never owns task, project, approval, escalation, or cognition state

PR17D adds the CI guard:

```bash
npm run ci:email-adapter-contract-check
```

This check verifies email payload construction, placeholder-recipient denial,
missing-provider skipped delivery, and the invariant that skipped email delivery
does not create external projection records.

### PR17E - Jira-like Ticket Adapter Design

PR17E introduces the design contract for Jira-like systems without building a
runtime Jira integration.

Jira-like systems are projection and collaboration adapters only.

They may eventually:

- project canonical projects, tasks, and threads as external tickets
- map external ticket IDs back to canonical AEP IDs
- ingest external comments as canonical thread messages
- request allowed actions through canonical AEP routes
- expose external URLs for human navigation

They must not:

- own task state
- own project state
- directly set canonical task status
- own approvals or escalations
- bypass canonical APIs
- expose private cognition

Status reconciliation is signal-based:

- external `todo` is informational
- external `in_progress` may create a canonical message
- external `blocked` requests manager review
- external `done` requests manager review
- no external status directly mutates canonical task/project state

PR17E adds the CI guard:

```bash
npm run ci:jira-like-adapter-design-contract-check
```

This check verifies that Jira remains mirror-only, requires projection mapping,
denies canonical state ownership, and has no direct canonical status mutation.

### PR17F - External Collaboration CI Coverage

PR17F consolidates PR17 adapter checks into a CI coverage layer.

The PR17 CI surface now guards:

- mirror routing contract
- external thread/message mapping
- inbound reply correlation
- duplicate delivery/idempotency
- external action idempotency
- external action policy enforcement
- skipped delivery with missing Slack/email configuration
- no committed placeholder recipients
- no external adapter ownership of canonical work state
- Jira-like systems remaining mirror-only (no canonical ownership)

The PR17 umbrella check is:

```bash
npm run ci:external-collaboration-contract-check
```

Additional adapter-specific checks:

```bash
npm run ci:slack-adapter-contract-check
npm run ci:email-adapter-contract-check
npm run ci:jira-like-adapter-design-contract-check
npm run ci:external-adapter-state-ownership-contract-check
```

PR17F does not add runtime adapter behavior. It makes the existing PR17
boundaries harder to regress.

### PR17G - External Collaboration Docs Closeout

PR17 is complete through PR17G.

PR17 final state:

- PR17A - adapter inventory and documentation alignment
- PR17B - canonical external collaboration contract
- PR17C - Slack adapter hardening
- PR17D - email adapter hardening
- PR17E - Jira-like ticket adapter design
- PR17F - external collaboration CI coverage
- PR17G - docs closeout

AEP now treats Slack, email, and Jira-like systems as external collaboration
adapters only.

Implemented adapters:

- Slack
- email

Implemented mirror-only adapter:

- Jira-like ticket systems

Canonical state remains in:

- tasks
- dependencies
- artifacts
- threads/messages
- approvals
- escalations
- intake requests
- projects
- mapping/audit tables

External systems may:

- mirror canonical threads/messages
- receive replies/actions
- project task/project/thread visibility
- map external IDs back to canonical AEP IDs

External systems must not:

- own task state
- own project state
- own approvals/escalations
- bypass canonical AEP APIs
- expose private cognition
- directly set canonical status

PR17/PR22 CI guardrails:

```bash
npm run ci:external-collaboration-contract-check
npm run ci:slack-adapter-contract-check
npm run ci:email-adapter-contract-check
npm run ci:jira-like-adapter-design-contract-check
npm run ci:pr22-jira-ingest-contract-check
npm run ci:external-adapter-state-ownership-contract-check
```

PR17 does not turn AEP into a Slack bot, email bot, Jira clone, or workflow
engine. It adds external collaboration surfaces for an organization runtime
whose canonical state remains AEP.

### PR18A - HR Contract Inventory

PR18A is docs-only and inventories the existing HR/staffing surface.

Current code-owned HR surfaces:

- employee catalog and projections via `/agent/employees`
- canonical employee creation via `POST /agent/employees`
- role-code employee ID allocation from `roles_catalog.employee_id_code`
- employee public profile, visual identity, and public links
- employee lifecycle actions:
  - activate
  - reassign team
  - change role
  - start/end leave
  - retire
  - terminate
  - rehire
  - archive
- employment event history
- persona generation and approval
- review cycles
- evidence-linked performance reviews
- task reassignment continuity when an employee becomes unavailable
- dashboard people-management surfaces backed by canonical routes

Missing PR18 contracts:

- `JobDescription`
- `StaffingRequest`
- `HiringRecommendation`
- `RoleGap`

Missing PR18 behavior:

- no staffing gap detection API
- no canonical hiring request lifecycle
- no hiring-request-to-employee linkage
- no staffing dashboard view for gaps and hiring requests
- no PR18 staffing CI umbrella

Important boundary:

> HR must not become a parallel system. Staffing changes must flow through
> canonical AEP routes, employee lifecycle events, approvals, threads/messages,
> tasks/projects, and audit surfaces.

PR18A makes no runtime changes.

### PR18B - Canonical Staffing Contract

PR18B adds code-owned staffing contracts without adding runtime routes or new
state mutation paths.

Canonical staffing contract kinds:

- `JobDescription`
- `StaffingRequest`
- `HiringRecommendation`
- `RoleGap`

Each contract defines:

- canonical ID field
- source linkage to task/project/thread/role/review/manager context
- AEP ownership
- lifecycle states
- approval boundary
- direct employee mutation denial
- parallel HR database denial

Important boundaries:

- role gaps are advisory only
- staffing requests require approval before fulfillment
- hiring recommendations require manager review / approval
- employee creation must flow through `POST /agent/employees`
- lifecycle changes must flow through existing employee lifecycle routes
- UI and external adapters must not own staffing state

PR18B CI guard:

```bash
npm run ci:staffing-contract-check
```

PR18B does not add:

- recruiting CRM behavior
- candidate pipeline state
- resume parsing
- auto-hiring
- direct employee table mutation outside canonical routes

### PR18C - Staffing Gap Detection

PR18C adds advisory-only staffing gap detection.

Implemented:

- `GET /agent/staffing/role-gaps`
- role gaps for roles with no active employees
- task impact detection for ready/blocked/queued tasks without active role/team capacity
- inactive/on-leave impact visibility
- dashboard API inclusion through department overview
- CI guard for advisory-only behavior

Important invariants:

- no employee creation
- no lifecycle mutation
- no approval mutation
- no task mutation
- no parallel HR state
- role gaps are advisory signals only

CI guard:

```bash
npm run ci:staffing-gap-detection-contract-check
```

### PR18D - Hiring Request Flow

PR18D introduces canonical staffing requests.

Lifecycle:

```text
draft -> submitted -> approved -> fulfilled / rejected / canceled
```

Implemented:

- `staffing_requests` D1 table
- canonical staffing request store
- `GET /agent/staffing/requests`
- `POST /agent/staffing/requests`
- `GET /agent/staffing/requests/:id`
- `POST /agent/staffing/requests/:id/status`
- PR18D CI guard

Boundaries:

- no auto-hiring
- no employee creation in PR18D
- no direct employee mutation
- approval requires approver identity
- role/team compatibility is validated against the role catalog
- staffing request state remains canonical AEP state
- UI/adapters may trigger routes later but must not own state

CI guard:

```bash
npm run ci:hiring-request-flow-contract-check
```

### PR18E - Hiring To Employee Creation

PR18E connects approved staffing requests to canonical employee creation.

Implemented:

- `POST /agent/staffing/requests/:id/fulfill`
- fulfillment requires an approved staffing request
- fulfillment calls the canonical employee lifecycle creation path
- employee ID generation remains role-code based
- created employee is linked back to the staffing request
- canonical thread message is published when the request source is a thread
- PR18E CI guard

Boundaries:

- no auto-hiring from role gaps
- no employee creation from unapproved staffing requests
- no direct employee table mutation outside the lifecycle store
- no hidden cognition
- no external adapter ownership of staffing state

CI guard:

```bash
npm run ci:hiring-employee-linkage-contract-check
```

### PR18F - Staffing Dashboard

PR18F exposes staffing in the dashboard.

Implemented:

- role gap visibility
- hiring request visibility
- request-from-gap action trigger
- submit / approve / reject / cancel request action triggers
- fulfill approved request action trigger
- staffing dashboard CI guard

Boundaries:

- UI reads canonical staffing state only
- UI triggers canonical routes only
- UI does not own staffing state
- UI does not directly create employees
- employee creation still flows through staffing fulfillment and employee lifecycle creation

CI guard:

```bash
npm run ci:staffing-dashboard-contract-check
```

### PR18G - Staffing CI Coverage

PR18G finalizes staffing system hardening through CI.

Added:

- umbrella staffing system contract check
- lifecycle correctness enforcement
- gap detection advisory enforcement
- hiring request -> employee linkage enforcement
- dashboard non-ownership enforcement
- CI artifact marker and purge-path enforcement

System guarantee:

> Staffing is now a first-class, enforced, non-bypassable part of the organization runtime.

Any violation of:

- lifecycle rules
- employee creation boundaries
- advisory-only gap detection
- canonical ownership

will fail CI.

### PR19 Direction - Agentic Product Construction

PR19 is not a conventional website implementation.

PR19's purpose is to prove that AEP can act as an organization that builds a
real external product through its own runtime.

Core rule:

> Do not build the website directly. Enable the organization to build it.

All product work must flow through canonical AEP primitives:

- intake
- projects
- tasks
- employees
- staffing
- artifacts
- approvals
- threads/messages
- validation
- deployment records

The customer-facing website is an artifact produced by AEP's own teams. It is
not manually added as an ordinary app outside the organization lifecycle.

PR19 target:

> AEP defines, staffs, builds, validates, deploys, and evolves its own external
> marketing/product surface.

The website should:

- present AEP to external customers
- be a polished marketing surface
- invite prospective customers to connect with the PM
- let customers define prospective projects
- route those interactions into canonical intake
- eventually turn customers into tenants

The website must not:

- own runtime state
- directly mutate tasks, projects, employees, or staffing
- expose private cognition
- expose prompt internals
- bypass approvals
- bypass staffing
- become a CRM

Agentic work model:

```text
customer/product goal
  -> intake / product initiative
  -> project
  -> task graph
  -> staffed teams
  -> artifacts
  -> validation
  -> deployment
  -> external surface
```

PR19 should use the existing organizational runtime rather than bypass it.

### PR19 Product Initiator Tutorial

The repository now includes:

```text
TUTORIAL.md
```

This file is the human-facing tutorial for initiating and steering AEP-built
products.

It defines the target PR19 user experience:

```text
human intent
  -> intake
  -> product initiative project
  -> task graph
  -> staffing
  -> artifacts
  -> approvals
  -> deployment
  -> validation
  -> feedback
  -> redesign / new tasks
  -> redeployment
  -> monitoring
  -> continued operation until retirement or transition
```

Important interpretation:

> `TUTORIAL.md` is not just documentation. It is the product experience PR19
> should make real.

The tutorial emphasizes that product construction is a loop, not a pipeline.
Validation, QA, human feedback, deployment evidence, and external signals may
change requirements, design, task graphs, staffing, and deployment plans for
the full life of the product.

Human visibility and intervention are first-class requirements.

PR19 should provide or prepare:

- initiative creation / update UI
- initiative dashboard
- task graph visibility
- public decision timeline
- validation feedback panel
- deployment visibility
- explicit intervention controls
- Jira / external mirroring for visibility and steering

Human intervention must route through canonical AEP primitives:

- tasks
- approvals
- threads/messages
- artifacts
- staffing requests

External systems such as Jira may mirror and collaborate, but must not own
canonical project, task, deployment, approval, or staffing state.

The goal of PR19 is to make the tutorial true.

If teams are missing capacity, PR19 should use PR18 staffing:

```text
role gap
  -> staffing request
  -> approval
  -> employee creation
  -> assigned work
```

Recommended PR19 stages:

- PR19A - Product initiative model
- PR19B - Deployable artifact contract
- PR19C - Deployment system
- PR19D - External surface contract
- PR19E - Customer-to-intake flow
- PR19F - Agentic work execution
- PR19G - Product-work observability
- PR19H - CI and safety guards
- PR19I - Docs closeout

### PR19I — Closeout

PR19 is now complete.

The system supports:

- product initiative definition (PR19A)
- deployable artifacts (PR19B)
- deployment system (PR19C)
- external-safe product surfaces (PR19D)
- customer intake flow (PR19E)
- agentic execution through task graphs (PR19F)
- human visibility and intervention (PR19G)
- enforcement and guardrails (PR19H)

The tutorial experience described in `TUTORIAL.md` is now achievable.

Core invariant:

> AEP builds products through an organization, not through direct execution.

All product work flows through:

- tasks
- employees
- artifacts
- approvals
- staffing

External systems:

- GitHub
- Cloudflare
- Jira

are adapters only and must not own canonical state.

PR19 enforcement:

```bash
npm run ci:guard-check
```

Important:

> PR19 completes the **model and control loop**.
> Post-PR19 work should focus on provider adapters, UI, and operational scale —
> not changing the core model.

### PR21A - Minimal Product UI

PR21A adds the first human-facing dashboard surface for product initiatives.

Implemented:

- product initiative list
- product initiative creation through canonical `POST /agent/projects`
- product initiative detail through `GET /agent/projects/:id/product-visibility`
- read-only task graph summary
- read-only deployable artifacts and deployment records
- human intervention creation through `POST /agent/projects/:id/interventions`
- public intervention / decision history from PR19G visibility messages

Boundaries:

- dashboard reflects AEP state
- dashboard does not own product state
- dashboard does not execute deployments
- dashboard does not mutate task status
- dashboard does not edit GitHub/provider state
- human steering creates canonical organizational signals only

CI guard:

```bash
npm run ci:product-ui-contract-check
```

### PR20 - Provider Adapters

PR20 realizes product deployment in external providers while preserving AEP as
the source of truth.

Implemented:

- provider adapter boundary for GitHub and Cloudflare
- canonical deployment execution route:
  - `POST /agent/product-deployments/:id/execute`
  - deployment execution updates canonical AEP deployment records
  - provider URLs and external IDs are recorded as evidence only
  - external-safe deployment execution remains approval-gated
  - provider execution publishes an org-visible coordination trace

Boundaries:

- provider adapters do not own AEP state
- GitHub does not own task/project/deployment state
- Cloudflare does not own task/project/deployment state
- dashboard does not execute deployments
- deployment execution must start from a canonical deployment record
- deployment execution must use the deployment route, not artifact creation

CI guard:

```bash
npm run ci:provider-adapter-contract-check
```

### PR21B - Full Product UI

PR21B extends the minimal product UI with richer read-only product visibility.

Implemented:

- deployment panel backed by canonical deployment records
- repository mirror panel backed by artifact/provider evidence
- artifact browser backed by canonical task artifacts
- decision timeline backed by public PR19G decision messages

Boundaries:

- UI remains read-first
- UI may create intervention requests only through canonical intervention routes
- UI must not execute deployments
- UI must not call `/agent/product-deployments/:id/execute`
- UI must not mutate task status or deployment status directly
- GitHub and Cloudflare remain adapters/evidence surfaces only

CI guard:

```bash
npm run ci:full-product-ui-contract-check
```

### PR22 - Jira Mirroring With Contracted Ingest

PR22 implements Jira as a collaboration mirror, not a canonical work-state
owner.

Implemented routes:

- `POST /agent/jira/projections`
- `POST /agent/jira/comments`
- `POST /agent/jira/status-signals`

Required invariant:

> Jira comments and status changes become canonical AEP thread/messages first;
> Jira must never directly mutate task/project/deployment/approval/escalation
> state.

CI guard:

```bash
npm run ci:pr22-jira-ingest-contract-check
```

### PR23 - Continuous Product Loop

PR23 introduces product signal ingestion for validation, monitoring, and
customer feedback.

Implemented:

- `POST /agent/product-signals`
- signal classification
- signal routing to intake or thread/message
- explicit guard that signals do not create tasks directly

Required flow:

```text
signal
  -> classification
  -> intake OR thread
  -> AEP decides task/approval/product evolution
```

Forbidden:

- signal -> createTask
- signal -> updateTaskStatus
- signal -> deployment mutation
- monitoring alert -> canonical state mutation
- validation failure -> direct task graph mutation

CI guard:

```bash
npm run ci:pr23-signal-ingest-contract-check
```

### PR24 - Product Lifecycle

PR24 introduces lifecycle request handling for product initiatives.

Implemented:

- `POST /agent/projects/:id/lifecycle-actions`
- lifecycle actions: `pause`, `resume`, `retire`, `transition`
- approval creation for lifecycle requests
- org-visible lifecycle discussion thread/message
- lifecycle coordination task
- audit payloads that explicitly forbid direct status mutation

Required flow:

```text
request
  -> approval + task
  -> decision
  -> state change
```

Forbidden:

- direct `project.status = "paused"`
- direct project status updates from lifecycle request route
- lifecycle transition without approval provenance
- lifecycle transition without task/thread audit trail

CI guard:

```bash
npm run ci:pr24-lifecycle-contract-check
```

PR19A should begin by defining how AEP represents a product initiative without
inventing a parallel workflow system. Prefer extending or specializing the
existing project/intake/task/artifact model before adding new primitives.

### PR19A - Product Initiative Model

PR19A makes product initiatives first-class as specialized canonical projects.

Implemented model:

- product initiative metadata is stored on `projects`
- supported metadata:
  - `initiativeKind`
  - `productSurface`
  - `externalVisibility`
- product initiatives must be owned by `team_web_product`
- product initiatives require complete initiative metadata
- product initiatives bootstrap canonical planning work:

```text
project_planning
  -> requirements_definition
  -> task_graph_planning
```

The bootstrap creates ordinary canonical tasks with dependencies and a visible
coordination thread/message. It does not implement a website, create a
deployment, or bypass staffing, artifacts, approvals, validation, or future
deployment records.

Important invariant:

> A product initiative is a project-shaped organizational container. The
> product surface is an artifact produced later through staffed canonical work.

PR19A CI guard:

```bash
npm run ci:product-initiative-contract-check
```

### PR19B - Artifact To Deployment Contract

PR19B defines deployable outputs as canonical task artifacts.

Supported deployable artifact kinds:

- `github_repository`
- `website_bundle`
- `deployment_candidate`

Deployable artifact invariants:

- deployable artifacts live inside existing task artifacts
- no deployment happens when the artifact is created
- external exposure requires a later deployment record
- external exposure requires approval
- AEP remains the source of truth for state
- GitHub, Pages, Workers, Jira, and other systems may hold external IDs or surfaces, but must not own canonical product/deployment state
- private cognition is never included in deployable artifact content

Required deployable artifact content:

```text
deployableArtifactKind
projectId
productSurface
state
stateOwnership: "aep"
```

Kind-specific content:

```text
github_repository -> repository
website_bundle -> bundle
deployment_candidate -> artifactRef + deploymentTarget
```

PR19B CI guard:

```bash
npm run ci:deployable-artifact-contract-check
```

Important invariant:

> PR19B defines what can later be deployed. PR19B does not deploy it.

### PR19C - Deployment System

PR19C introduces canonical product deployment records.

Deployment flow:

```text
deployment_candidate artifact
  -> product deployment record
  -> approval gate for external_safe exposure
  -> status lifecycle
  -> visible coordination trace
```

Supported deployment statuses:

- `requested`
- `approved`
- `in_progress`
- `deployed`
- `failed`
- `canceled`

Deployment records link:

- company
- project
- source task
- source artifact
- requesting employee
- environment
- external visibility
- approval id when required
- deployment target metadata
- target URL when available

Important invariants:

- deployment records are canonical AEP state
- creating a deployment record does not execute external deployment
- only `deployment_candidate` artifacts in `ready_for_deployment` state can create deployment records
- `external_safe` deployment records require approval linkage
- PR19C currently enforces approval id presence, not approval existence/approved-status verification
- PR19H must enforce: `external_safe` cannot move to `deployed` without a valid approved approval record
- provider systems may supply URLs/evidence later but must not own canonical deployment state
- deployment state is visible and human-intervenable

PR19C CI guard:

```bash
npm run ci:deployment-system-contract-check
```

### PR19D - External Surface Contract

PR19D defines what a customer-facing surface may expose.

External surfaces are not state owners.

Supported external surface kinds:

- `marketing_site`
- `customer_intake`
- `public_progress`

External surface invariants:

- canonical owner is AEP
- state ownership must be `aep`
- customer requests route into canonical AEP intake
- external surfaces must not mutate tasks directly
- external surfaces must not mutate approvals directly
- external surfaces must not mutate deployment records directly
- external surfaces must not mutate employees or staffing directly
- external surfaces must not expose private cognition, prompt internals, hidden reasoning, or employee private thought

External surfaces may expose safe actions such as:

- `submit_intake`
- `request_contact`
- `view_public_progress`
- `view_public_artifact`

External surfaces are validated as part of deployable artifact creation when the
artifact content includes `externalSurfaceKind`.

Important invariant:

> The website may be public, but the organization remains private and canonical
> state remains inside AEP.

PR19D CI guard:

```bash
npm run ci:external-surface-contract-check
```

### PR19E - Customer Intake Flow

PR19E connects external-safe product surfaces to canonical AEP intake.

Flow:

```text
external surface
  -> POST /agent/customer-intake
  -> canonical intake_request
  -> visible coordination thread/message
  -> PM triage
  -> optional conversion to product initiative project
```

The customer intake route is intentionally narrow.

It may:

- create canonical intake
- preserve customer/external provenance
- publish an org-visible coordination trace
- deduplicate by idempotency key

It must not:

- create projects directly
- create tasks directly
- create approvals directly
- create deployments directly
- mutate employees or staffing directly
- expose private cognition or prompt internals

Customer intake records preserve:

- `externalSurfaceKind`
- `productSurface`
- `sourceUrl`
- `idempotencyKey`
- `customerContact`

Important invariant:

> The website creates demand. The organization decides what work exists.

PR19E CI guard:

```bash
npm run ci:customer-intake-flow-contract-check
```

### PR19F - Agentic Product Execution

PR19F turns product initiatives into executable organizational work.

It introduces:

```text
POST /agent/projects/:id/product-execution
```

The route creates a canonical task graph:

```text
web_design
  -> web_implementation
  -> test_execution
  -> deployment
  -> verification

deployment
  -> monitoring_setup
```

The graph assigns work to:

- `team_web_product`
- `team_validation`
- `team_infra`

Important invariants:

- PR19F creates tasks, not product code
- PR19F creates tasks, not artifacts
- PR19F creates deployment work, not deployment records
- PR19F keeps the organization as the execution owner
- artifacts, deployment candidates, deployment records, approvals, and provider
  execution happen later through their canonical routes

PR19F also updates intake conversion so customer/external intake can become a
product initiative project with PR19A bootstrap tasks.

This is the first PR19 stage where the tutorial loop becomes executable:

```text
customer/user demand
  -> intake
  -> product initiative
  -> execution task graph
  -> staffed work
  -> artifacts / validation / deployment records in later stages
```

PR19F CI guard:

```bash
npm run ci:agentic-execution-contract-check
```

### PR19G - Observability And Human Intervention

PR19G makes the tutorial experience visible and steerable.

Visibility route:

```text
GET /agent/projects/:id/product-visibility
```

It aggregates:

- project state
- source intake
- related customer intake
- tasks
- artifacts
- deployable artifacts
- deployment records
- public decision / rationale / coordination messages
- suggested intervention actions

Intervention route:

```text
POST /agent/projects/:id/interventions
```

Supported human actions:

- `add_direction`
- `request_redesign`
- `change_priority`
- `review_validation`
- `review_deployment_risk`
- `pause_for_human_review`

The intervention route creates:

- org-visible thread
- human-authored message
- canonical coordination task

It must not directly mutate:

- task execution state
- artifacts
- deployment records
- approvals
- staffing
- employees

Important invariant:

> Human steering is itself organizational work. Intervention creates visible
> messages and tasks instead of bypassing AEP.

PR19G CI guard:

```bash
npm run ci:product-visibility-contract-check
```

### PR19H - Enforcement Guards

PR19H locks the PR19 model so later work cannot bypass the organization.

Runtime enforcement:

- `external_safe` deployment records require an approval id
- the approval id must reference an existing approval
- the approval must be in `approved` state before external-safe deployment
  creation or status movement to `approved`, `in_progress`, or `deployed`

CI enforcement:

```bash
npm run ci:boundary-enforcement-check
npm run ci:tutorial-alignment-check
```

The boundary check enforces:

- customer intake cannot create projects directly
- customer intake cannot create tasks directly
- customer intake cannot create artifacts directly
- customer intake cannot create deployments directly
- human interventions cannot mutate task/artifact/deployment state directly
- only task artifact routes create artifacts
- only product deployment routes mutate deployment records
- product contract/runtime code does not directly invoke provider deployment
- external surfaces do not own canonical state
- deployable artifacts do not deploy themselves

The tutorial alignment check enforces:

- `TUTORIAL.md` exists
- PR19 docs continue to describe a loop, not a pipeline
- API docs include the product initiative, customer intake, product execution,
  visibility, intervention, and deployment surfaces
- docs continue to preserve private cognition and AEP source-of-truth
  boundaries

Important invariant:

> PR19H does not add capability. It prevents future work from breaking the
> product-construction experience promised by `TUTORIAL.md`.

Important invariant:

> The product surface is the output. The organization runtime is the builder.

### PR16D - Cognitive Prioritization And Manager-Mediated Parking

PR16D makes prioritization a cognitive decision rather than a fixed code rule.

Core principle:

> Code defines constraints. Cognition makes decisions.

What remains code-defined:

- Canonical task model (tasks, dependencies, artifacts)
- Task contract registry (types, payloads, expectations)
- Candidate task set (ready + assigned tasks)
- Safety boundaries (no hidden state, no direct mutation outside APIs)
- Audit surfaces (threads, artifacts, logs)

What becomes cognitive:

- Task prioritization within a team
- Tradeoffs between competing ready tasks
- Whether to split, defer, or delegate work
- Planning and task graph creation
- Identification of scheduling conflicts
- Recommendation of preemption (not execution of it)

Team loop evolution:

1. Gather candidate tasks (ready, assigned, dependency-satisfied)
2. Construct bounded execution context
3. Invoke role cognition (LLM) to rank tasks, generate private reasoning, and produce a public rationale summary
4. Select task or request manager intervention
5. Publish decision as coordination thread message, with optional rationale artifact

Important boundary:

- Private reasoning remains private
- Only public rationale summaries are persisted

### Manager-Mediated Prioritization And Preemption

Workers do not autonomously preempt tasks.

Flow:

team loop detects conflict or higher-priority work
-> publishes scheduling context
-> manager reviews
-> manager decides
-> system applies decision

This preserves AEP as a company, not an autonomous swarm.

### Task State Extension

PR16D introduces:

status: parked

Meaning:

- task is intentionally paused
- not eligible for execution
- retains full context and artifacts
- can be resumed to ready

State model:

queued -> ready -> in_progress -> completed
                 -> parked -> ready

Constraints:

- parking is manager-mediated
- no silent worker-driven parking
- all transitions must be auditable

### Preemption Model (Bounded)

Preemption is not an interrupt primitive.

It is modeled as:

current task -> parked
new task -> executed

With explicit manager decision, thread/artifact record, and no hidden state transitions.

### Cognitive Scheduling Invariants

Must always hold:

- No hidden prioritization state outside canonical surfaces
- No scheduler tables
- No dashboard-owned scheduling state
- No direct mutation of tasks outside APIs
- All decisions reconstructable from tasks, artifacts, threads, approvals, and manager logs

### Architectural Intent

PR16D continues AEP's evolution from deterministic task execution toward a cognitively steered organization runtime, where contracts define boundaries, cognition exercises judgment, and managers enforce prioritization decisions including parking/resume transitions.
- Intake and projects are canonical operator-agent state. The dashboard only calls canonical routes and must not become the owner of intake, project, or task state.
- Project task graphs must use existing canonical tasks and dependencies. Do not introduce a parallel project-work store.

```bash
titan@Titans-MacBook-Pro aep % tree . --gitignore
.
├── .github
│   └── workflows
│       ├── README.md
│       ├── _deploy-dashboard-pages.yml
│       ├── _deploy_environment.yml
│       ├── _deploy_preview_environment.yml
│       ├── _validate_async_orchestration.yml
│       ├── _validate_contracts_layer.yml
│       ├── _validate_environment_layer.yml
│       ├── _validate_escalation_integrity.yml
│       ├── _validate_multi_worker_safety.yml
│       ├── _validate_operator_governance.yml
│       ├── _validate_operator_surface.yml
│       ├── _validate_paperclip_handoff.yml
│       ├── _validate_policy_layer.yml
│       ├── _validate_scenarios_layer.yml
│       ├── _validate_runtime_read_safety.yml
│       ├── _validate_schema_layer.yml
│       ├── deploy-preview.yml
│       ├── deploy-production.yml
│       ├── deploy-staging.yml
│       ├── destroy-preview.yml
│       ├── free-leaked-resouces.yml
│       ├── inject-doc-includes.yml
│       ├── validate-async-deep.yml
│       └── validate-async-environment.yml
├── apps
│   ├── dashboard
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── src
│   │   │   ├── api.ts
│   │   │   ├── main.ts
│   │   │   ├── render.ts
│   │   │   ├── styles.css
│   │   │   ├── types.ts
│   │   │   └── vite-env.d.ts
│   │   └── tsconfig.json
│   └── ops-console
│       ├── index.html
│       ├── package.json
│       ├── src
│       │   ├── api.ts
│       │   ├── main.ts
│       │   ├── render.ts
│       │   ├── styles.css
│       │   ├── types.ts
│       │   └── vite-env.d.ts
│       └── tsconfig.json
├── core
│   ├── control-plane
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── generated
│   │   │   │   └── build-meta.ts
│   │   │   ├── index.ts
│   │   │   ├── lib
│   │   │   │   ├── build-info.ts
│   │   │   │   ├── http.ts
│   │   │   │   └── urls.ts
│   │   │   ├── operator
│   │   │   │   ├── advance-timeout.ts
│   │   │   │   ├── catalog-metadata.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── derive.ts
│   │   │   │   ├── eligibility.ts
│   │   │   │   ├── metadata.ts
│   │   │   │   ├── queries.ts
│   │   │   │   ├── runs.ts
│   │   │   │   ├── runtime-projection.ts
│   │   │   │   └── types.ts
│   │   │   ├── org
│   │   │   │   ├── ownership.ts
│   │   │   │   ├── store.ts
│   │   │   │   └── types.ts
│   │   │   └── routes
│   │   │       ├── healthz.ts
│   │   │       ├── operator.ts
│   │   │       ├── org.ts
│   │   │       ├── runs.ts
│   │   │       └── tenants.ts
│   │   ├── tsconfig.json
│   │   ├── wrangler.jsonc
│   │   └── wrangler.preview.jsonc.template
│   ├── observability
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── operator-agent
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── src
│   │   │   ├── adapters
│   │   │   │   ├── email-adapter.ts
│   │   │   │   ├── external-policy.ts
│   │   │   │   ├── inbound-action-correlation.ts
│   │   │   │   ├── inbound-action-types.ts
│   │   │   │   ├── inbound-correlation.ts
│   │   │   │   ├── inbound-types.ts
│   │   │   │   ├── mirror-dispatcher.ts
│   │   │   │   ├── mirror-routing-policy.ts
│   │   │   │   ├── paperclip.ts
│   │   │   │   ├── slack-webhook-adapter.ts
│   │   │   │   └── types.ts
│   │   │   ├── agents
│   │   │   │   ├── infra-ops-manager.ts
│   │   │   │   ├── pm-agent.ts
│   │   │   │   ├── retry-supervisor.ts
│   │   │   │   ├── timeout-recovery.ts
│   │   │   │   └── validation-agent.ts
│   │   │   ├── config.ts
│   │   │   ├── generated
│   │   │   │   └── build-meta.ts
│   │   │   ├── index.ts
│   │   │   ├── lib
│   │   │   │   ├── api-client.ts
│   │   │   │   ├── approval-policy.ts
│   │   │   │   ├── budget-enforcer.ts
│   │   │   │   ├── build-info.ts
│   │   │   │   ├── cooldown-store.ts
│   │   │   │   ├── decision-log.ts
│   │   │   │   ├── employee-cognition.ts
│   │   │   │   ├── employee-work-loop.ts
│   │   │   │   ├── escalation-state.ts
│   │   │   │   ├── execute-employee-run.ts
│   │   │   │   ├── execution-context.ts
│   │   │   │   ├── fallback-config.ts
│   │   │   │   ├── human-interaction-threads.ts
│   │   │   │   ├── human-visibility-summary.ts
│   │   │   │   ├── logger.ts
│   │   │   │   ├── org-resolver.ts
│   │   │   │   ├── org-scope-resolver.ts
│   │   │   │   ├── paperclip-auth.ts
│   │   │   │   ├── policy-merge.ts
│   │   │   │   ├── policy.ts
│   │   │   │   ├── rationale-thread-publisher.ts
│   │   │   │   ├── store-factory.ts
│   │   │   │   ├── store-types.ts
│   │   │   │   ├── validate-paperclip-request.ts
│   │   │   │   ├── verifier.ts
│   │   │   │   └── work-log-reader.ts
│   │   │   ├── persistence
│   │   │   │   └── d1
│   │   │   │       ├── approval-store-d1.ts
│   │   │   │       ├── budget-enforcer-d1.ts
│   │   │   │       ├── control-history-log-d1.ts
│   │   │   │       ├── cooldown-store-d1.ts
│   │   │   │       ├── d1-ids.ts
│   │   │   │       ├── d1-json.ts
│   │   │   │       ├── employee-catalog-store-d1.ts
│   │   │   │       ├── employee-control-store-d1.ts
│   │   │   │       ├── employee-lifecycle-store-d1.ts
│   │   │   │       ├── employee-prompt-profile-store-d1.ts
│   │   │   │       ├── escalation-log-d1.ts
│   │   │   │       ├── manager-decision-log-d1.ts
│   │   │   │       ├── performance-review-store-d1.ts
│   │   │   │       ├── role-catalog-store-d1.ts
│   │   │   │       ├── task-reassignment-store-d1.ts
│   │   │   │       ├── task-store-d1.ts
│   │   │   │       └── work-log-store-d1.ts
│   │   │   ├── org
│   │   │   │   ├── authority.ts
│   │   │   │   ├── budgets.ts
│   │   │   │   ├── company.ts
│   │   │   │   ├── departments.ts
│   │   │   │   ├── employees.ts
│   │   │   │   ├── escalation.ts
│   │   │   │   ├── roles.ts
│   │   │   │   ├── services.ts
│   │   │   │   └── teams.ts
│   │   │   ├── routes
│   │   │   │   ├── approval-detail.ts
│   │   │   │   ├── approvals-approve.ts
│   │   │   │   ├── approvals-reject.ts
│   │   │   │   ├── approvals.ts
│   │   │   │   ├── build-info.ts
│   │   │   │   ├── control-history.ts
│   │   │   │   ├── employee-approve-persona.ts
│   │   │   │   ├── employee-controls.ts
│   │   │   │   ├── employee-employment-events.ts
│   │   │   │   ├── employee-effective-policy.ts
│   │   │   │   ├── employee-generate-persona.ts
│   │   │   │   ├── employee-lifecycle-actions.ts
│   │   │   │   ├── employee-reviews.ts
│   │   │   │   ├── employee-scope.ts
│   │   │   │   ├── employee-update.ts
│   │   │   │   ├── employees.ts
│   │   │   │   ├── escalation-detail.ts
│   │   │   │   ├── escalations-acknowledge.ts
│   │   │   │   ├── escalations-resolve.ts
│   │   │   │   ├── escalations.ts
│   │   │   │   ├── healthz.ts
│   │   │   │   ├── manager-log.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── run-once.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── review-cycles.ts
│   │   │   │   ├── scheduler-status.ts
│   │   │   │   ├── task-artifacts.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── te-purge-employee.ts
│   │   │   │   ├── te-seed-approval.ts
│   │   │   │   ├── te-seed-work-log.ts
│   │   │   │   ├── thread-approval-actions.ts
│   │   │   │   ├── thread-delegate-task.ts
│   │   │   │   ├── thread-escalation-actions.ts
│   │   │   │   └── work-log.ts
│   │   │   ├── triggers
│   │   │   │   ├── cron.ts
│   │   │   │   ├── manager-cron.ts
│   │   │   │   └── scheduled.ts
│   │   │   ├── types
│   │   │   │   ├── execution-provenance.ts
│   │   │   │   └── paperclip-run-request.ts
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── wrangler.jsonc
│   ├── runtime-contract
│   │   └── runtime_contract.ts
│   ├── types
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   └── workflow-engine
│       ├── package.json
│       ├── src
│       │   └── index.ts
│       └── tsconfig.json
├── docs
│   ├── ci-mental-model.md
│   ├── decisions
│   │   ├── 0001-repo-structure.md
│   │   ├── 0002-cloudflare-first.md
│   │   └── 0003-observability-first.md
│   └── mvp
│       └── aep-mvp-v1.md
├── examples
│   ├── aws-lambda
│   │   ├── index.mjs
│   │   └── README.md
│   └── sample-worker
│       ├── package.json
│       ├── src
│       │   └── index.ts
│       ├── tsconfig.json
│       └── wrangler.toml
├── infra
│   ├── cloudflare
│   │   ├── d1
│   │   │   ├── migrations
│   │   │   │   ├── 0001_mvp.sql
│   │   │   │   ├── 0002_deploy_jobs.sql
│   │   │   │   ├── 0003_deploy_job_attempts.sql
│   │   │   │   ├── 0004_retry_policy.sql
│   │   │   │   ├── 0005_commit13_org_catalog.sql
│   │   │   │   ├── 0006_commit13_service_provider.sql
│   │   │   │   ├── 0007_validation_results.sql
│   │   │   │   ├── 0008_validation_result_governance.sql
│   │   │   │   ├── 0009_validation_runs.sql
│   │   │   │   ├── 0010_validation_result_audit.sql
│   │   │   │   ├── 0011_validation_dispatch_batch.sql
│   │   │   │   └── 0012_internal_tenant_flag.sql
│   │   │   └── operator-agent-migrations
│   │   │       ├── 0001_operator_agent_governance.sql
│   │   │       ├── 0002_operator_agent_governance_backfill_helpers.sql
│   │   │       ├── 0003_operator_agent_budget_cooldown.sql
│   │   │       ├── 0004_org_catalog_bridge.sql
│   │   │       ├── 0005_service_provider_bridge.sql
│   │   │       ├── 0006_validation_specialist_catalog_seed.sql
│   │   │       ├── 0007_tasks_and_decisions.sql
│   │   │       ├── 0008_cognitive_identities.sql
│   │   │       ├── 0009_add_internal_monologue_to_decisions.sql
│   │   │       ├── 0010_employee_prompt_profiles.sql
│   │   │       ├── 0011_operator_agent_coordination.sql
│   │   │       ├── 0012_operator_agent_task_artifacts.sql
│   │   │       ├── 0013_operator_agent_message_threads.sql
│   │   │       ├── 0014_operator_agent_human_interaction_threads.sql
│   │   │       ├── 0015_operator_agent_thread_response_actions.sql
│   │   │       ├── 0016_thread_task_delegation.sql
│   │   │       ├── 0017_message_ingestion_hardening.sql
│   │   │       ├── 0018_message_mirror_deliveries.sql
│   │   │       ├── 0019_external_thread_projection_map.sql
│   │   │       ├── 0020_external_action_records.sql
│   │   │       ├── 0021_external_interaction_policy.sql
│   │   │       ├── 0022_employee_lifecycle_foundation.sql
│   │   │       ├── 0023_task_reassignment.sql
│   │   │       ├── 0024_performance_reviews.sql
│   │   │       └── 0025_employee_synthetic_flag.sql
│   │   └── wrangler
│   │       └── README.md
│   └── github
│       └── workflows
│           └── README.md
├── API.md
├── LLM.md
├── package-lock.json
├── package.json
├── packages
│   ├── event-schema
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   └── shared
│       ├── package.json
│       └── src
│           ├── index.ts
│           └── providers.ts
├── README.md
├── scripts
│   ├── backfill
│   ├── ci
│   │   ├── apply-d1-migrations.sh
│   │   ├── check-operator-agent-coordination-schema.sh
│   │   ├── checks
│   │   │   ├── contracts
│   │   │   │   ├── approval-thread-action-contract-check.ts
│   │   │   │   ├── approval-thread-conflict-contract-check.ts
│   │   │   │   ├── approval-thread-contract-check.ts
│   │   │   │   ├── employee-cognition-boundary-check.ts
│   │   │   │   ├── employee-persona-continuity-check.ts
│   │   │   │   ├── employee-scope-check.ts
│   │   │   │   ├── escalation-thread-action-contract-check.ts
│   │   │   │   ├── escalation-thread-contract-check.ts
│   │   │   │   ├── external-action-contract-check.ts
│   │   │   │   ├── external-interaction-policy-contract-check.ts
│   │   │   │   ├── external-thread-mapping-contract-check.ts
│   │   │   │   ├── inbound-reply-correlation-contract-check.ts
│   │   │   │   ├── message-thread-contract-check.ts
│   │   │   │   ├── mirror-routing-contract-check.ts
│   │   │   │   ├── operator-agent-contract-check.ts
│   │   │   │   ├── operator-surface-check.ts
│   │   │   │   ├── provider-provenance-check.ts
│   │   │   │   ├── public-rationale-artifact-check.ts
│   │   │   │   ├── runtime-projection-check.ts
│   │   │   │   ├── runtime-provenance-check.ts
│   │   │   │   ├── runtime-tenant-catalog-check.ts
│   │   │   │   ├── service-provider-check.ts
│   │   │   │   ├── task-artifact-contract-check.ts
│   │   │   │   ├── task-dependency-integrity-check.ts
│   │   │   │   ├── task-run-cognitive-contract-check.ts
│   │   │   │   ├── task-visibility-summary-check.ts
│   │   │   │   ├── thread-linkage-invariant-check.ts
│   │   │   │   ├── thread-rationale-publication-check.ts
│   │   │   │   ├── thread-task-delegation-contract-check.ts
│   │   │   │   ├── validate-runtime-read-safety.ts
│   │   │   │   └── validation-result-artifact-check.ts
│   │   │   ├── environment
│   │   │   │   ├── async-deploy-check.ts
│   │   │   │   ├── check-health.ts
│   │   │   │   ├── smoke-test.ts
│   │   │   │   └── wait-for-url.ts
│   │   │   ├── policy
│   │   │   │   ├── approval-state-machine-check.ts
│   │   │   │   ├── check-validation-policy.ts
│   │   │   │   ├── escalation-audit-check.ts
│   │   │   │   ├── escalation-lifecycle-check.ts
│   │   │   │   ├── manager-advisory-check.ts
│   │   │   │   ├── manager-policy-overlay-check.ts
│   │   │   │   ├── operator-action-check.ts
│   │   │   │   ├── operator-agent-behavior-check.ts
│   │   │   │   └── scheduled-routing-check.ts
│   │   │   ├── scenarios
│   │   │   │   ├── agent-message-mirroring-check.ts
│   │   │   │   ├── agent-timeout-recovery-check.ts
│   │   │   │   ├── approval-thread-delegation-check.ts
│   │   │   │   ├── check-validation-verdict.ts
│   │   │   │   ├── dispatch-validation-runs.ts
│   │   │   │   ├── escalation-thread-delegation-check.ts
│   │   │   │   ├── execute-validation-dispatch.ts
│   │   │   │   ├── execute-validation-work-order.ts
│   │   │   │   ├── external-action-idempotency-check.ts
│   │   │   │   ├── external-action-policy-enforcement-check.ts
│   │   │   │   ├── external-approval-action-check.ts
│   │   │   │   ├── external-escalation-action-check.ts
│   │   │   │   ├── external-reply-policy-enforcement-check.ts
│   │   │   │   ├── external-style-message-idempotency-check.ts
│   │   │   │   ├── external-style-message-order-tolerance-check.ts
│   │   │   │   ├── human-visibility-summary-check.ts
│   │   │   │   ├── inbound-duplicate-delivery-check.ts
│   │   │   │   ├── inbound-reply-ingestion-check.ts
│   │   │   │   ├── multi-worker-department-check.ts
│   │   │   │   ├── org-resolver-planning-defaults-check.ts
│   │   │   │   ├── paperclip-company-handoff-check.ts
│   │   │   │   ├── paperclip-first-execution-check.ts
│   │   │   │   ├── pm-planning-task-graph-check.ts
│   │   │   │   ├── post-deploy-validation.ts
│   │   │   │   ├── purge-synthetic-employees.ts
│   │   │   │   ├── repeated-pm-persona-continuity-check.ts
│   │   │   │   ├── repeated-validation-persona-continuity-check.ts
│   │   │   │   ├── run-recurring-validation.ts
│   │   │   │   ├── strategic-dispatch-test.ts
│   │   │   │   ├── synthetic-failure-test.ts
│   │   │   │   ├── task-reassignment-continuity-check.ts
│   │   │   │   ├── threaded-mirror-continuity-check.ts
│   │   │   │   └── validation-loop-feedback-check.ts
│   │   │   └── schema
│   │   │       ├── company-coordination-schema-check.ts
│   │   │       ├── operator-agent-org-schema-check.ts
│   │   │       ├── org-inventory-route-check.ts
│   │   │       └── org-schema-check.ts
│   │   ├── clients
│   │   │   └── operator-agent-client.ts
│   │   ├── contracts
│   │   │   ├── approvals.ts
│   │   │   ├── employees.ts
│   │   │   ├── escalations.ts
│   │   │   ├── manager.ts
│   │   │   └── work-log.ts
│   │   ├── create-preview-wrangler-config.sh
│   │   ├── destroy-preview-resources.sh
│   │   ├── ensure-d1-database.sh
│   │   ├── free-leaked-resources.sh
│   │   ├── generate-build-meta.sh
│   │   ├── inject-doc-blocks.sh
│   │   ├── resolve-environment-urls.sh
│   │   ├── setup
│   │   ├── shared
│   │   │   ├── adapter-capability.ts
│   │   │   ├── assert.ts
│   │   │   ├── env.ts
│   │   │   ├── http.ts
│   │   │   ├── operator-agent-check-helpers.ts
│   │   │   ├── operator-agent-surface.ts
│   │   │   ├── service-map.ts
│   │   │   └── soft-skip.ts
│   │   ├── tasks
│   │   │   ├── poll.ts
│   │   │   ├── result-lines.ts
│   │   │   ├── retry.ts
│   │   │   ├── run-checks.ts
│   │   │   ├── run-observe.ts
│   │   │   ├── run-operator-agent-backend-tests.ts
│   │   │   └── validation-dispatch.ts
│   │   └── verify-staging-layered.sh
│   ├── deploy
│   │   ├── run-node-deploy.ts
│   │   └── run-node-teardown.ts
│   ├── dev
│   │   ├── bootstrap-aws-github-secrets.sh
│   │   ├── bootstrap.sh
│   │   ├── dev-stack-stop.ts
│   │   ├── dev-stack.ts
│   │   ├── test-deploy.ts
│   │   └── write-service-map.ts
│   ├── lib
│   │   ├── http-json.ts
│   │   ├── operator-agent-skip.ts
│   │   └── service-map.ts
│   └── tsconfig.json
├── services
│   ├── deployment-engine
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   ├── node-wrangler-adapter.ts
│   │   │   ├── providers
│   │   │   │   ├── aws
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── node-adapter.ts
│   │   │   │   │   └── worker-adapter.ts
│   │   │   │   ├── cloudflare
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── node-adapter.ts
│   │   │   │   │   └── worker-adapter.ts
│   │   │   │   └── gcp
│   │   │   │       ├── index.ts
│   │   │   │       ├── node-adapter.ts
│   │   │   │       └── worker-adapter.ts
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   └── worker-adapter.ts
│   │   └── tsconfig.json
│   └── proving-ground
│       ├── package.json
│       └── src
│           └── index.ts
└── tsconfig.base.json
```
---

# 1. What AEP is

AEP is:

> the infra department of an agentic, zero-employee company

It models:

* companies
* teams
* employees
* tasks
* coordination
* governance

It is NOT:

* a chatbot system
* a workflow script runner
* a stateless LLM wrapper

It IS:

> an organization runtime

More concretely, the intended company shape is:

- a **Web team** that designs and builds websites and webapps
- an **Infra team** that deploys and monitors those systems on Cloudflare and AWS
- a **Validation team** that tests dev and deployed systems and reports issues
- **PM roles** that define work from research, customer needs, and requests
- **HR / staffing roles** that define job descriptions and request human-approved employee creation

The target is not a generic "agent platform." It is a real operational digital company with durable people, durable teams, and explicit governed work.

---

# 2. Canonical architectural model

## Core primitives

### Tasks
Tasks are the canonical unit of work.

They carry:
- company / originating team / assigned team
- optional employee assignment
- task type
- title
- payload
- lifecycle status
- dependency state
- provenance from source thread / approval / escalation when applicable
- optional project linkage in task payload (`projectId`, `intakeRequestId`, `projectTaskClientId`) when tasks are created from a project task graph

### Intake Requests
Intake requests are the canonical demand signal for new work entering the company.

They represent:
- customer requests
- internal operator requests
- research or PM-identified opportunities
- future website / Slack / email / Jira-sourced demand

Important invariants:
- intake does not execute work
- intake does not create tasks directly
- intake may be triaged, rejected, or converted
- intake-to-project conversion publishes only public coordination rationale
- private PM cognition must not be exposed

### Projects
Projects are canonical containers for structured execution.

Projects may be created directly or converted from intake requests.

Important invariants:
- projects do not execute work directly
- projects own/organize task graphs
- task graph creation must use canonical tasks and dependencies
- every project-created task is linked back through task payload
- no parallel project-work table or project-local task state may be introduced

### Artifacts
Artifacts are durable work products attached to tasks.

Canonical artifact types remain:
- `plan`
- `result`
- `evidence`

Important artifact payload kinds now include:
- `execution_plan`
- `public_rationale`
- `validation_result`

### Threads
Threads are the canonical unit of communication.

Threads may be linked to:
- tasks
- approvals
- escalations
- artifacts

Messages inside threads are durable and explicit.  
External channels do not replace them.

### Decisions
Task decisions record:
- verdict
- reasoning
- evidence trace
- private internal monologue where applicable

Private cognition stays private.

### External mappings
Slack/email mirroring, external thread mappings, inbound replies, and explicit external actions are projections and interaction surfaces layered on top of canonical AEP threads/messages.

This same boundary should hold for future Jira-like systems:

- AEP remains canonical for work state and provenance
- external ticket systems are adapters and projections
- external mutation must reconcile through canonical AEP routes, mappings, and audit

### Approvals and escalations
Approvals and escalations are explicit governance primitives.  
They are not hidden side effects or implicit message semantics.

### External mappings
Slack/email mirroring, external thread mappings, inbound replies, and explicit external actions are projections and interaction surfaces layered on top of canonical AEP threads/messages.

---

# 3. Hard rules

## Canonical boundary

AEP is the source of truth.

Slack and email are adapters only.

They must NOT become:

* the task store
* the communication source of truth
* the approval source of truth
* the provenance source of truth

All canonical state must remain in:

* tasks
* threads
* artifacts
* approvals
* escalations
* audit / mapping tables

## Cognition boundary

LLM cognition belongs inside the employee boundary.

Employees have:

* public profile (visible)
* private cognition (hidden)

Private cognition includes:

* base_prompt
* identity_seed
* decision_style
* collaboration_style
* portrait_prompt
* internal reasoning

These MUST NEVER be exposed via:

* APIs
* UI
* threads
* artifacts

Only bounded public rationale may be published.

* private reasoning remains private
* bounded public rationale is published
* threads are publication surfaces, not cognition dumps
* no route-level free-form cognition generation
* no shared hidden company brain

## Employees as persons boundary

Employees are durable digital persons with:

* public identity
* team and role
* job description
* public profile (bio, skills)
* digital footprint (GitHub, LinkedIn)
* visual embodiment
* employment history
* work history

Employees persist across:

* tasks
* roles
* teams
* lifecycle transitions

But employees also contain a private internal self.

Private cognition includes:

* base_prompt
* identity_seed
* decision_style
* collaboration_style
* portrait_prompt
* internal reasoning

Those private fields MUST NEVER be exposed through:

* APIs
* UI
* threads
* artifacts

## Job Description (JD)

The company interacts with employees, not with prompts.

Each role has a Job Description (JD) defining:

* responsibilities
* success metrics
* constraints

JDs are:

* public
* stable
* company-owned

JDs are NOT prompts.

They influence behavior indirectly through:

JD → tasks → execution → outputs

Role contracts may now also carry data-driven runtime metadata in `roles_catalog`, such as:

* `employee_id_code`
* `runtime_enabled`
* `implementation_binding`
* `manager_role_id`

These fields help the runtime stay data-driven without making public JDs into prompts.
Private role-level cognitive scaffolding belongs in private prompt-profile tables, not in public role reads.

Employee creation should derive new employee IDs from `roles_catalog.employee_id_code`, not from hardcoded TS maps.
Runtime policy should stay code-owned at the role layer. Live runtime paths should not hardcode employee instance IDs; they should resolve active employees from D1 by company, team, and role intent, and CI should discover current runtime employees from `/agent/employees` when it needs live identities.
When role/team/runtime is not specific enough because multiple live employees share the same role, CI should refine selection semantically instead of falling back to seeded-id conventions:

* use scope requirements such as `allowedServices`, `allowedTenants`, or `allowedEnvironmentNames` via `/agent/employees/:employeeId/scope`
* use expected role metadata such as `runtimeEnabled`, `implementationBinding`, `managerRoleId`, or `employeeIdCode` via `/agent/roles`
* use a bounded behavior-based matcher only when structural metadata is insufficient; for example, select a PM candidate by observed public-rationale style through public task and thread surfaces rather than by private prompt-profile storage

This is now the intended CI contract embodied by `scripts/ci/lib/employee-resolution.ts`.
The intended canonical format is:

* `<two-letter-role-code><3-digit-sequence>`

Examples:

* `qa001`
* `pm001`
* `dv001`

These examples describe the derived ID shape only. Runtime-facing code, docs, and CI should not depend on specific canonical employee ids when live employee discovery by role/team intent is available.
Legacy `emp_*` seeded IDs are historical only and should not be introduced in new runtime code, config defaults, or validation checks.

Execution-facing role validation should also be catalog-driven:

* role must exist in `roles_catalog`
* role must belong to the employee's team
* executable roles must have `runtime_enabled = true`

Do not reintroduce route-local hardcoded role allowlists for employee creation or execution validation.

Execution dispatch should now follow this rule:

* `roles_catalog.implementation_binding` selects the execution family
* the runtime must resolve that binding through an explicit code-owned allowlist/registry
* unknown bindings, missing bindings, or role/binding mismatches must fail closed

Do not use open-ended dynamic dispatch, dynamic imports from DB strings, or any design where catalog edits alone can introduce arbitrary executable behavior.

Stage 5 cognition assembly should follow this layering:

* public role contract (`roles_catalog`)
* private role scaffold (`role_prompt_profiles`)
* private employee prompt profile (`employee_prompt_profiles`)
* effective policy/runtime context
* bounded task/dependency/artifact context

The role contract informs cognition indirectly and may be included as structured context, but public JDs must still not be treated as raw prompt internals exposed through APIs or UI.

## Employee Lifecycle

Employees have explicit lifecycle states:

* draft
* active
* on_leave
* retired
* terminated
* archived

Lifecycle transitions must be:

* explicit
* auditable
* thread-linked

JDs are NOT prompts and must not become a hidden cognition leak path.

## Runtime vs employment boundary

Runtime control is separate from employment state.

Examples:

* disabled / restricted = runtime control
* on_leave = employment state
* retired = employment state
* terminated = employment state

Do not conflate runtime disablement with lifecycle transitions.

## Work continuity boundary

When an employee becomes unavailable, authorship remains immutable but responsibility may transfer.

The system must resolve open work via canonical state using:

* reassignment
* escalation
* deferral
* blocking with explicit reason

Defaults:

* on_leave → reassign or escalate
* terminated → reassign immediately
* disabled → retry then escalate

Authorship is immutable.
Responsibility is transferable.

## Visual Identity

Employees have a visual identity.

Public:

* avatar
* birth year
* appearance summary

Private:

* visual_base_prompt
* portrait_prompt

Appearance evolves over time.

Private visual prompts must not be exposed.

## Performance Reviews

Performance reviews are grounded in:

* job descriptions
* observable work
* canonical artifacts
* canonical threads
* governance records

Performance reviews must NOT expose:

* prompt internals
* internal reasoning
* personality configuration

Reviews may drive:

* promotion
* reassignment
* coaching
* restriction
* termination

## Explainability boundary

Human-readable explanations are allowed only if:

* they are derived from canonical state
* they are deterministic
* they do not expose hidden reasoning

No LLM-generated explanations outside the employee boundary.

## Explicit control

All control must be explicit and routed through canonical primitives:

* tasks
* threads
* approvals
* escalations
* control surfaces

# PR PATCH LIST RULES (STRICT)

You are generating a precise, copy-pasteable patch for a codebase.
Output requirements (STRICT)

1. FIRST: output a FILE-BY-FILE PATCH LIST (diff-style, PARTIAL ONLY)

Always wrap a patch in "```diff" so it is presented is raw text for easy cut and paste.

For EACH modified file:

path/to/file.ext

@@ <context or function/class name>
- <old code>
+ <new code>

Rules:

* ONLY include CHANGED sections (no full file replacements)
* Include enough surrounding context to locate the change
* Use valid unified diff style (@@ blocks)
* Multiple @@ blocks per file if needed
* Do NOT include unchanged code outside context
* Do NOT summarize changes
* Do NOT omit necessary imports/types if they are modified
* Ensure patches are syntactically correct and realistically applicable

⸻

2. AFTER all patches: output the COMMIT MESSAGE

Format:

commit-type(subsystem): short_title 

coomit body:
    * 5–10 lines describing:
    * what changed
    * why it changed
    * key implementation details
    * any constraints or follow-ups

Where commit-type is one of: feat | fix | chore | refactor | ...
Where subsystem is: docs | test | ci | ...

⸻

3. Ordering:

* Files in logical dependency order (e.g., types → logic → API → UI → tests)
* Within each file, order @@ blocks top-to-bottom

⸻

4. STRICT OUTPUT:

* No commentary outside this structure
* No explanations before or after
* Only emit:
    * file patch sections
    * then commit message
 
---

# 4. Current repo-aligned system state

At this commit, the system supports:

- task-backed execution
- dependency-aware task orchestration
- durable artifacts (`plan`, `result`, `evidence`)
- message threads as canonical communication substrate
- inbox / outbox / thread detail
- approval-linked threads
- escalation-linked threads
- thread-based human actions
- thread → task delegation with durable provenance
- bounded employee cognition with optional AI binding and deterministic fallback
- durable bounded public rationale artifacts
- rationale publication into canonical related threads
- external message mirroring
- external thread/message mapping
- inbound external reply ingestion
- explicit external approval/escalation actions
- external interaction policy and audit hardening
- validation-result artifacts and validation loop feedback
- human-facing task/thread visibility summaries on canonical read surfaces
- canonical role review dimensions, review cycles, and evidence-linked performance reviews
- dashboard-backed people / org-management surfaces over canonical routes
- synthetic employee flagging (`is_synthetic`) and archived-only synthetic purge support
- cleanup-token authorized synthetic purge path for non-test-endpoint environments
- CI synthetic employee cleanup scenario and environment-targeted leaked-resource cleanup workflow

Important runtime rules:

- endpoint documentation is centralized in `API.md`; consult it first for route details
- canonical company is `company_internal_aep`

Current practical interpretation of the repo state:

- the foundational runtime primitives are strong
- PR12 company / work / mirror / activity UI is present
- PR13 lifecycle / persona / review / people-management surfaces are present
- the main remaining gap is not primitive storage or routing
- the main remaining gap is turning teams and roles into persistent operating loops with business-facing intake and delivery

---

# 5. PR status

## PR6 — Organization kernel
Complete.

Delivered:
- org structure
- employee boundary
- task coordination
- dependency orchestration
- durable task artifacts
- documentation / CI structural lock

## PR7 — Cognitive organization
Complete.

Delivered:
- bounded cognition
- internal canonical messaging
- human interaction threads
- delegation
- durable public rationale
- persona continuity and rationale style continuity

## PR10 — External interaction substrate
Complete.

Delivered:
- outbound mirroring
- external thread/message projection
- inbound reply ingestion
- explicit external actions
- external policy / permission / audit hardening

## PR11 — Agentic work loops
Complete.

Delivered:
- PR11A: employee loop ignition
- PR11B: manager planning and canonical task graph creation
- PR11.5: org-routing decoupling bridge
- PR11D.1: canonical validation result artifacts
- PR11D.2: validation artifact contract coverage
- PR11D.3: validation loop feedback scenario coverage
- PR11E: human visibility and control hardening

PR11 end state:

> employees can reason, plan, create work, execute work, validate work, and expose their activity through canonical task/thread/artifact surfaces with human visibility and explicit control.

---

# 6. Current human-visible surfaces

## Task detail
Canonical task detail now includes:
- task
- dependencies
- artifacts
- decision
- related threads
- visibility summary

Task visibility summary exposes:
- artifact counts
- whether plan / rationale / validation artifacts exist
- latest validation status
- latest decision verdict
- related thread counts
- approval / escalation thread counts

## Thread detail
Canonical thread detail now includes:
- thread
- messages
- external projections
- external interaction policy
- external interaction audit
- visibility summary

Thread visibility summary exposes:
- related task / approval / escalation linkage
- message count
- rationale publication presence
- latest public rationale presentation style
- approval / escalation action counts
- external projection count
- external interaction policy booleans

These are the first PR11E visibility/control surfaces.  
They are API/read-surface hardening, not yet a full UI redesign.

---

# 7. CI / validation model

CI is a layered validation system.

Canonical layers:
- environment
- schema
- contracts
- policy
- scenarios

All validation references should live under:

```text
scripts/ci/checks/<layer>/...
````

Do not reintroduce flat `scripts/ci/<file>.ts` entrypoints.

Reusable validation lanes must:

* avoid assuming test-only `/agent/te/...` endpoints exist
* prefer live state where possible
* soft-skip cleanly when environment-specific setup is absent

Important practical rule:

* required product surfaces should fail if missing
* test-only seed/setup surfaces may soft-skip

<!-- BEGIN: docs/ci-mental-model.md -->
# CI / Validation Mental Model (Canonical)

## Purpose

CI in AEP is not just automation.

It is the **validation system of the organization**.

It exists to enforce:
- structure
- contracts
- policy
- execution correctness

---

## System model

CI is organized as a **layered validation system**.

### Validation layers

- **environment**
  - readiness
  - health checks
  - smoke validation

- **schema**
  - org schema
  - operator-agent org schema
  - coordination schema
  - inventory routes

- **contracts**
  - operator-agent contract
  - runtime projection
  - runtime provenance
  - tenant catalog
  - employee scope
  - provider checks
  - operator surface
  - thread task delegation

- **policy**
  - operator-agent behavior
  - manager policy overlay
  - approvals
  - escalations
  - routing
  - validation policy

- **scenarios**
  - post-deploy validation
  - dispatch / execution / verdict flows
  - approval / escalation thread delegation
  - paperclip execution
  - multi-worker coordination
  - synthetic failure testing

---

## Workflow model

Reusable workflows are structured by layer:

- `_validate_environment_layer.yml`
- `_validate_schema_layer.yml`
- `_validate_contracts_layer.yml`
- `_validate_policy_layer.yml`
- `_validate_scenarios_layer.yml`

Top-level workflows compose these layers into full validation lanes:

- preview
- staging
- production
- async-validation

---

## Script model

Validation scripts must follow a **layered directory structure**:

```
scripts/ci/checks/
  environment/
  schema/
  contracts/
  policy/
  scenarios/
```

Shared logic:

```
scripts/ci/tasks/
scripts/ci/shared/
```

Shell utilities:

```
scripts/ci/*.sh
```

---

## ❗ Forbidden pattern

Flat validation entrypoints are **deprecated and forbidden**.

Do NOT use:

```
scripts/ci/<file>.ts
```

All validation must reference:

```
scripts/ci/checks/<layer>/<script>.ts
```

---

## URL contract (CI.9)

All deploy and validation workflows operate on:

- `CONTROL_PLANE_BASE_URL`
- `OPERATOR_AGENT_BASE_URL`

### Resolution order

1. explicit workflow input
2. environment variable

### Important

- deploy outputs are **diagnostic only**
- validation must not depend on implicit URL resolution
- no legacy secret-based URL fallback is allowed

---

## Design principles

CI must be:

- **layered**
- **explicit**
- **composable**
- **contract-driven**

CI must NOT be:

- ad-hoc
- script-coupled
- environment-implicit
- dependent on hidden behavior

Reusable validation lanes must NOT:

- assume test-only `/agent/te/...` endpoints are enabled
- depend on seeded setup that exists only in test-mode environments

Reusable validation lanes should:

- prefer existing live approvals / escalations / threads where possible
- soft-skip cleanly when suitable live data is absent

---

## Mental model

CI is:

> the validation system of the organization

It is equivalent to:

- QA
- compliance
- operational verification

in a traditional company

---

## Invariants (must never change)

- validation is layered
- scripts are not flat
- workflows compose layers
- URL contract is explicit
- deploy and validation are separable but composable
- reusable workflows must avoid test-only endpoint assumptions

---

## Regression guard (for humans and LLMs)

If you see:

```
scripts/ci/<file>.ts
```

It is outdated and must be replaced with:

```
scripts/ci/checks/<layer>/<file>.ts
```

---

## Relationship to AEP architecture

CI is a **system layer**, alongside:

- execution (Workers / DO)
- AEP infra department
- future company layer

It enforces correctness across all of them.

---

## Final principle

> Build CI as part of the system, not around the system.
<!-- END: docs/ci-mental-model.md -->

---

# 8. Current product gap

The system has moved beyond basic UI exposure.

The next major product gap is organizational operations over embodied employees:

* employee lifecycle
* role and job-description management
* employee embodiment as durable persons
* richer persona generation with private cognition boundaries preserved
* work continuity when employees become unavailable
* performance reviews grounded in canonical evidence
* org-management UI for hiring, reassignment, leave, retirement, and termination

That earlier gap is now only part of the picture. The larger gap to the intended company model is:

- Web / Infra / Validation are not yet fully realized as autonomous operating teams
- PM behavior is not yet strong enough as a first-class work-definition loop
- HR/staffing exists in lifecycle form but not yet as a richer organizational-design workflow
- project intake, customer requests, and client-facing backlog shaping are still weak
- external systems such as Slack/email are present as adapters, but operational provisioning and team usage are still incomplete
- Jira-like ticket reflection is not yet implemented
- there is currently no super-admin-only debug view into private cognition; the default boundary is intentionally strict

So the next phase should focus on **organizational behavior and business-facing operating loops**, not on inventing new core primitives casually.

---

# 9. PR12 — Agentic Company UI + Human Collaboration (COMPLETED)

PR12 now includes:

* PR12A — canonical work UI
* PR12B — embodied employees and company presence
* PR12C — human interjection through canonical thread collaboration
* PR12D — external mirror visibility
* PR12E — narrative company timeline / work theater
* PR12F — causality / why things happened
* PR12G — active control surfaces / steering
* PR12H — identity continuity / employees feel real over time
* PR12I — live system feel / low-jank refresh
* PR12J — UX / copy / canonicality tightening
* PR12K — explainability polish / human-readable causality

---

## PR12B — Embodied Employees + Company Presence (COMPLETED)

The system now exposes a **first-class company surface** derived entirely from canonical AEP data.

### Company view

The dashboard now includes:

- `#company`
- `#employees`
- `#employee/:id`
- `#teams`
- `#team/:id`
- `#validation`

These surfaces are **read-only projections** over canonical state.

---

### Employees (embodiment layer)

Employees now have **public presence**:

- displayName
- bio
- skills
- avatarUrl

This is rendered in:

- employee directory
- employee detail pages
- team views
- company overview

Critical boundary:

> Public profile is presentation-only  
> Cognitive profile remains private inside employee execution boundary

---

### Teams (derived, not modeled)

Teams are:

- derived from employee membership
- not a separate canonical entity (yet)

Team views show:

- employees
- tasks (assigned/originating)
- threads (task-linked)
- roadmap entries

---

### Company surface

The company view aggregates:

- employees
- teams
- tasks
- threads
- roadmaps

This creates:

> a **legible organizational layer** over canonical execution primitives

---

### Architectural rule (reinforced)

PR12B maintains:

- no UI-owned state
- no parallel company model
- no derived truth outside canonical sources

Everything comes from:

- employees
- tasks
- threads
- roadmaps

---

### Result

AEP now behaves as:

> a visible, embodied digital company

Where:

- employees are recognizable
- work is attributable
- teams are legible
- the organization can be navigated


---

## PR12C — Human Interjection + Canonical Thread Collaboration (COMPLETED)

The dashboard now supports human participation through canonical AEP thread routes.

### Implemented

* thread detail includes a canonical message composer
* endpoint documentation and route invariants are centralized in `API.md`
* approvals remain explicit thread actions
* escalations remain explicit thread actions
* free-form thread participation does not become hidden governance mutation

### Result

Humans can now:

* participate directly in canonical task/governance threads
* shape work through visible thread messaging
* take explicit approval/escalation actions through dedicated thread controls

This preserves:

* canonical task/thread/artifact/governance state
* the cognition boundary
* the separation between conversation and governance mutation

---

## PR12D — External Mirror Visibility (COMPLETED)

The dashboard now exposes Slack/email mirrors as visible adapter projections over canonical AEP threads.

### Implemented

* dedicated mirrors view
* projection targets surfaced at company level
* external interaction policy surfaced clearly
* external interaction audit surfaced clearly
* thread-first drill-down remains canonical

### Result

Humans can now see:

* which canonical threads are mirrored externally
* where those mirrors are projected
* whether inbound replies and external actions are allowed
* how external interaction decisions were audited

This preserves the architectural rule:

> Slack/email remain projections and interaction surfaces only.  
> AEP-native threads/messages remain canonical.

---

## PR12E — Narrative Timeline / Work Theater (COMPLETED)

The dashboard now exposes a narrative company-activity surface derived from canonical AEP work.

### Implemented

* dedicated activity view
* narrative timeline derived from canonical task/task-detail/thread/thread-detail reads
* task stories
* approval stories
* escalation stories
* coordination thread stories

### Important rule preserved

No backend activity log or new canonical primitive was introduced.

The activity surface is a projection over:

* tasks
* artifacts
* threads
* approvals/escalations via linked governance threads

### Result

AEP now shows not only canonical work objects, but also:

> a coherent story of what the company is doing now

This is the beginning of “work theater” without sacrificing canonicality.

---

## PR12F — Causality / Why Things Happened (COMPLETED)

The dashboard now exposes explicit causal links over canonical work and communication surfaces.

### Implemented

* task detail causality panel
* thread detail causality panel
* narrative timeline causality hints
* derived links from:
  * sourceThreadId
  * sourceMessageId
  * sourceApprovalId
  * sourceEscalationId
  * related threads
  * approval-linked threads
  * escalation-linked threads

### Important rule preserved

No backend causality graph or new canonical primitive was introduced.

Causality is derived from existing canonical provenance and linkage fields.

### Result

Humans can now answer not only:

> what is happening?

but also:

> why did this happen, and what canonical object led to it?

---

## PR12G — Active Control Surfaces / Steering (COMPLETED)

The dashboard now exposes first-class steering surfaces backed by canonical AEP routes.

### Implemented

* employee detail governance/policy panel
* employee control state visibility
* effective policy visibility
* thread → delegate follow-up task surface
* delegation through canonical thread action route

### Important rule preserved

Steering remains explicit and auditable.

The dashboard does not invent new control semantics.
It only exposes canonical routes already owned by AEP.

### Result

Humans can now not only inspect work and causality, but also:

> steer follow-up work and inspect employee governance state through explicit canonical controls

---

## PR12H — Identity Continuity / Employees Feel Real Over Time (COMPLETED)

The dashboard now gives employees visible continuity over time.

### Implemented

* employee “working now” surface
* recent task continuity
* active thread continuity
* recent manager-decision continuity
* recent control-history continuity

### Important rule preserved

No employee continuity store or synthetic identity-memory model was introduced.

Continuity is derived from canonical:

* tasks
* threads
* manager log
* control history

### Result

Employees now appear not only as profiles and governance targets, but as:

> ongoing actors with recent work, activity, and governance history

---

## PR12J — UX / Copy / Canonicality Tightening (COMPLETED)

The dashboard now presents the PR12 surfaces with clearer naming and stronger canonicality framing.

### Implemented

* tightened primary navigation labels
* replaced outdated toolbar copy
* clarified governance labeling
* clarified thread canonicality in thread detail
* clarified mirror secondary/projection status in mirrors view

### Important rule preserved

This was a presentation-only tightening pass.

No backend primitives, routes, or canonical state changed.

### Result

The company UI now better communicates the real AEP model:

> canonical company work lives in AEP, while external systems remain secondary projections

---

## PR12I — Live System Feel / Low-Jank Refresh (COMPLETED)

The dashboard now feels more operational without changing the canonical architecture.

### Implemented

* smarter auto-refresh behavior
* refresh only while the page is visible
* freshness indicators in the toolbar
* explicit “live surface” framing for operational views
* live-surface copy added to activity, work, task, thread, employee, and governance views

### Important rule preserved

This is still a polling-based client behavior layer.

No websockets, backend primitives, or new canonical state were introduced.

### Result

The company UI now feels more like an operational surface:

> current, refreshing, and active — without compromising canonicality

---

## PR12K — Explainability Polish / Human-readable Causality (COMPLETED)

The dashboard now presents causality in human-readable form.

### Implemented

* synthesized “why this happened” explanations in:
  * activity timeline
  * task detail
  * thread detail
* explanations derived from canonical provenance fields

### Important rule preserved

No LLM-generated reasoning or hidden cognition was introduced.

Explanations are deterministic and derived from canonical state.

### Result

Users can now understand:

> not just what happened and why structurally,
> but also why in plain language

---

# 10. After PR12

PR12 is complete.

The system now provides:

* observable work
* explainable causality
* explicit governance
* human collaboration
* external mirroring
* steering surfaces
* identity continuity
* operational UI surfaces

The next major phase is now PR13.

PR13 is focused on:

* employee lifecycle
* employees as durable persons
* job descriptions as public role contracts
* work continuity under employee unavailability
* performance reviews grounded in canonical work
* org-management UI

Beyond PR13, the next meaningful phase is not just "more employee management."

It is the transition from:

- visible governed employees

to:

- functioning autonomous teams that can intake, design, delegate, execute, validate, deploy, and communicate as a company

---

# 11. Current focus (PR13 planning)

We are now planning and executing PR13 as a staged expansion of the organization model.

The goal is to move from:

* visible employees

to:

* manageable employees with lifecycle, embodiment, continuity, and review

PR13 must preserve:

* canonicality
* bounded cognition
* explicit governance
* immutable authorship
* transferability of responsibility

After verifying PR13A-G in code, the active strategic focus should shift toward team-level operation.

That means:

- making Web / Infra / Validation real operating units
- strengthening PM-driven work definition
- adding business/project intake as canonical work inputs
- preserving the existing employee boundary and canonical thread/task/artifact model while moving toward autonomous company heartbeat behavior

---

# 12. PR13 milestone plan

## PR13A — Employee lifecycle schema + public role model

Deliver:

* canonical employee lifecycle states
* role and job-description model
* employment history
* public links / footprint
* visual identity public/private split
* read routes and projections

## PR13B — Lifecycle actions + employment governance

Deliver:

* hire / create employee
* activate
* reassign team
* change role
* start leave / end leave
* retire
* terminate
* rehire
* archive

## PR13C — Embodiment + persona generation

Deliver:

* draft employee creation from textual description
* public profile generation
* private prompt-profile generation
* visual identity generation scaffolding
* approval flow for generated private profiles

### PR13C.1

The persona-generation path is now richer and model-driven when AI is available.

It must still:

* preserve deterministic fallback
* keep prompt internals private
* return only public-safe profile fields plus synthesis metadata
* require explicit approval before prompt-profile activation

## PR13D — Work continuity + responsibility transfer

Deliver:

* continuity policy model
* explicit handling for on_leave / retired / terminated / runtime-disabled employees
* reassignment / escalation / defer / block outcomes
* continuity visibility in canonical work surfaces

## PR13E — Job descriptions + performance reviews (COMPLETED)

Implemented:

* canonical JD model
* review dimensions per role
* review cycles
* evidence-linked performance reviews
* review-driven promotion / coaching / reassignment / restriction recommendations

Operator-agent now exposes canonical people-review surfaces through:

* `GET /agent/roles`
* `GET /agent/review-cycles`
* `POST /agent/review-cycles`
* `GET /agent/employees/:employeeId/reviews`
* `POST /agent/employees/:employeeId/reviews`

Important invariant:

* employee review dimensions come from canonical role contracts
* review evidence links point to canonical tasks, artifacts, or threads
* public role/JD/review surfaces do not expose private cognition or prompt internals
* role-level prompt scaffolding remains private even when role metadata becomes more data-driven

## PR13F — People / org-management UI (COMPLETED)

Implemented:

* people directory
* employee detail
* hiring flows
* lifecycle action surfaces
* role / JD detail
* performance review views
* org and staffing management surfaces

The dashboard now includes canonical people-management routes:

* `#employees`
* `#employee/:employeeId`
* `#roles`
* `#role/:roleId`

The dashboard now supports direct canonical write flows for:

* employee creation
* employee profile updates
* employee lifecycle transitions
* review-cycle creation
* employee-review creation

Important invariant:

* the dashboard remains a surface over canonical operator-agent routes
* it does not create a parallel people-management state model
* lifecycle and review changes remain explicit, auditable HTTP mutations

## PR13H — Validation Control Surface (COMPLETED)

The dashboard now exposes a first-class validation operations surface.

Added canonical control-plane routes:

* `GET /validation/overview`
* `GET /validation/scheduler`
* `POST /validation/run-now`
* `POST /validation/scheduler/pause`
* `POST /validation/scheduler/resume`

The dashboard now includes:

* `#validation`

This surface shows:

* recent validation runs
* recent validation results
* cron/manual origin metadata
* scheduler pause state
* last requested dispatch metadata

Important invariants:

* recurring validation cron executes internally in the control-plane and records `internal://control-plane/recurring-validation`
* manual dashboard-triggered validation records `internal://control-plane/manual-validation-run-now`
* pausing recurring validation suppresses cron-driven execution but does not block explicit manual `run-now`
* scheduler state is persisted in D1 via `validation_scheduler_state`

## PR13G — Hardening + policy + realism pass (COMPLETED)

Implemented:

* lifecycle invariant hardening for invalid transition combinations
* stronger review-policy realism checks on cycle status, evidence existence, and high-impact recommendation approval
* expanded CI negative-case coverage for lifecycle and review invariants
* company-view copy tightening so people-management terminology is consistent
* LLM.md tree/state refresh to match the repo more closely
* synthetic purge now exists as a narrowly scoped cleanup/admin surface for `is_synthetic = true` and `employment_status = archived`
* authorization requires `ENABLE_TEST_ENDPOINTS=true`

Important invariant:

* archived employees are not a generic active lifecycle target
* reviews may only be created against active review cycles
* review evidence must point to canonical tasks, artifacts, or threads that exist
* high-impact review recommendations remain explicit and approval-linked
* only `is_synthetic = true` employees may be permanently purged
* purge additionally requires `employment_status = archived`
* purge authorization is allowed only through `ENABLE_TEST_ENDPOINTS=true`
* future tightening should route purge through a narrower internal admin policy gate

---

# 12.5 Goal-oriented gap assessment

The intended end-state for AEP is a digital company with at least these operational team shapes:

- Web team
- Infra team
- Validation team
- PM roles
- HR / staffing roles

And these forcing-function outputs:

- a customer-facing marketing website
- websites and webapps delivered by the company
- deployment/monitoring across Cloudflare and AWS
- employee-facing email identities
- team Slack mirroring
- Jira-like human-readable/human-writeable work reflection

Relative to that goal, the repo today already has:

- durable employees
- lifecycle and review surfaces
- canonical tasks, artifacts, and message threads
- external mirroring substrate
- governance and visibility surfaces

Relative to that goal, the repo still materially lacks:

- persistent team heartbeat loops
- richer project / client / intake modeling
- stronger PM / dev / infra / validation role behavior separation
- HR as a fuller staffing workflow rather than only lifecycle mutation
- external provisioning and operational integration for Slack/email/Jira-like systems
- a tightly scoped super-admin cognition-debug surface

The important conclusion is:

> AEP does not mainly need new storage primitives right now.  
> It mainly needs team operating behavior layered onto the primitives it already has.

---

# 12.6 Likely next phase after PR13

After PR13 verification and closeout, the next phase should focus on **team operating loops**.

The likely first step is a team-heartbeat / team-work-loop phase that makes teams behave as persistent execution units rather than passive catalog partitions.

Expected emphasis:

- PM framing of work
- Web implementation work
- Infra deploy/monitor work
- Validation execution/reporting work
- canonical publication of summaries into threads
- reuse of existing task / artifact / approval / escalation primitives

Do not invent a parallel company model for this.  
Build it on top of the existing canonical AEP model.

---

# 12.7 Milestone roadmap — runtime to operating company

This roadmap defines the staged evolution of AEP from an organization runtime into a fully operating digital company composed of autonomous teams, governed workflows, and human-integrated collaboration surfaces.

---

## Current State Summary (as of latest repo)

AEP currently provides:

- canonical organization runtime:
  - employees
  - roles
  - teams
  - tasks
  - artifacts
  - threads
  - approvals and escalations

- strong governance:
  - runtime role policies (authority, budget, escalation)
  - lifecycle management
  - performance reviews
  - CI contract enforcement

- execution primitives:
  - `/agent/run` and `/agent/run-once`
  - scheduled cron triggers
  - task graphs and delegation via threads

- external adapters (partial):
  - Slack/email mirroring
  - inbound reply ingestion
  - external action mapping

What is missing:

- real team specialization outputs
- HR / staffing workflows
- Jira-like collaboration integration
- productized outputs (customer-facing site)
- super-admin cognition debug surface

---

# Milestone Plan

## PR14 — Team Operating Loops

### Goal

Turn teams from static catalog entities into active operating units.

### Scope

- Introduce team execution loop:
  - `/agent/teams/run`
  - `/agent/teams/:teamId/run-once`

- Team behavior:
  - select ready canonical tasks
  - execute or delegate via existing employee model
  - emit heartbeat messages into canonical threads
  - explicitly represent idle/waiting state

- Integrate with:
  - existing cron/scheduler system
  - existing task lifecycle and provenance
  - existing message/thread system

### Must reuse

- tasks
- threads
- artifacts
- approvals and escalations

### Must not

- introduce parallel schedulers
- bypass task ownership
- create hidden execution paths

### Validation

- CI scenario:
  - team selects ready task
  - team logs heartbeat
  - team handles no-task condition cleanly

### Status

✅ Implemented

---

## PR15 — Project and Intake Model

### Goal

Make AEP a company with a real front door for work.

Shift from:

- teams execute tasks autonomously

to:

- company receives work -> structures it -> assigns it -> executes it

This is the work-intake and project-structuring layer that feeds existing team loops.

### Canonical primitives

- `intake_requests`
  - external or internal demand signals (submitted, triaged, converted, rejected)
  - examples: build website, fix bug, add feature, improve SEO

- `projects`
  - structured containers for execution
  - may link back to an intake request
  - own the task graph lifecycle context

### Core invariant

- no parallel task system is introduced
- tasks and dependencies remain canonical execution primitives
- PR15 adds structured creation and linkage only

### Scope

#### PR15A — Intake Requests (canonical)

- backend table: `intake_requests`
- routes:
  - `POST /agent/intake`
  - `GET /agent/intake`
  - `GET /agent/intake/:id`
- invariant:
  - no tasks are created here; intake is signal capture only

#### PR15B — Project Model

- backend table: `projects`
- routes:
  - `POST /agent/projects`
  - `GET /agent/projects`
  - `GET /agent/projects/:id`
- invariants:
  - a project may link to intake
  - project is the container for downstream task graph planning

#### PR15C — PM Agent: Intake -> Project

- PM flow:
  1. read intake
  2. decide reject or convert
  3. when converting, create project and update intake status
- rationale boundary:
  - no hidden reasoning is exposed
  - bounded rationale is published via canonical threads

#### PR15D — Project -> Task Graph

- PM creates initial tasks and dependencies using existing task surfaces
- no new task subsystem is introduced
- expected pattern:
  - project context -> tasks -> dependencies -> team loop execution

#### PR15E — UI: Intake + Projects

- dashboard intake view:
  - submit form, list requests, status tracking
- dashboard project view:
  - list projects, link to tasks, project status visibility
- UI remains caller/projection, not state owner

#### PR15F — CI and invariants

- add checks for:
  - intake creation
  - project creation
  - intake -> project conversion
  - project-linked task graph creation
  - optional: no direct bypass patterns where policy forbids them

#### PR15G — Docs and continuity

- update:
  - `LLM.md` architecture and PR15 flow
  - `README.md` how work enters the company
  - `API.md` intake and project endpoints

### Invariants

- tasks remain canonical execution unit
- PM frames work but does not replace task provenance
- do not embed intake logic inside tasks
- do not expose PM hidden reasoning directly
- use canonical threads for explanation and rationale publication
- keep authorship and responsibility model intact
- keep AEP canonical state as source of truth

### End-to-end flow after PR15

User/client/system
-> intake request
-> PM team triage and structuring
-> project
-> task graph (existing)
-> team loops (PR14)
-> execution and heartbeats

### Validation

- CI scenario:
  - intake created -> project created -> tasks generated -> lineage preserved

### Status

✅ Implemented (PR15A-F complete; PR15G closes docs continuity)

---

## PR16 — Real Team Specialization

### Goal

Make Web, Infra, and Validation teams produce distinct work products.

### Scope

#### Web Team

- design artifacts
- implementation artifacts

#### Infra Team

- deployment plans
- deployment results
- monitoring artifacts

#### Validation Team

- validation reports
- issue identification

#### PM

- cross-team task graphs
- delivery orchestration

### Expected Artifact Payload Kinds

- `design_spec`
- `implementation_plan`
- `deployment_plan`
- `deployment_result`
- `validation_report`

(These should be payload `kind` values under canonical artifact types unless schema requires extension.)

### Validation

- CI scenario:
  - PM creates graph
  - Web → Infra → Validation execution chain
  - artifacts created and linked correctly

### Status

🟡 Partially prepared (agents, deployment engine, validation exist; specialization not enforced)

---

## PR17 — External Collaboration Adapters

### Goal

Make AEP usable through human collaboration tools without making them canonical.

### Scope

- Slack integration:
  - team/channel mapping
  - outbound summaries
  - inbound replies

- Email integration:
  - employee identities
  - escalation/notification routing

- Jira-like integration:
  - task projection
  - ticket mapping
  - bidirectional reconciliation

### Hard Invariant

> AEP is the source of truth. External systems are adapters only.

### Validation

- CI scenarios:
  - Slack mirror routing correctness
  - inbound reply reconciliation
  - external action idempotency
  - ticket mapping consistency

### Status

🟡 Partially implemented (Slack/email mirror + routing exist; Jira not implemented)

---

## PR18 — HR and Staffing System

### Goal

Introduce organizational design and staffing workflows.

### Scope

- Job Description (JD) workflows:
  - creation
  - review

- Hiring workflows:
  - hiring requests
  - human-approved employee creation

- Staffing:
  - assign employees to teams
  - track role coverage and capacity

### Must preserve

- JDs are public role contracts, not prompts
- private cognition remains hidden
- only synthetic employees are purge-eligible

### Validation

- CI scenario:
  - JD → hiring request → employee created → assigned → active in runtime

### Status

🟡 Partially implemented (lifecycle, persona, reviews exist; HR workflows not implemented)

---

## PR19 — Productization and Real Output

### Goal

Use AEP to deliver a real customer-facing product.

### Forcing Function Product

- marketing website
- company identity surface
- “People” / agent showcase
- project intake interface

### Delivery Loop

```text
lead / request
  → PM framing
  → Web design/build
  → Infra deploy/monitor
  → Validation test/report
  → delivery
  → feedback
```

### Validation

- end-to-end execution of a real project through all teams
- artifacts and threads reflect full lifecycle

### Status

❌ Not implemented

---

## Future: Super-Admin Cognition Debug Layer

### Goal

Enable controlled debugging of private cognition without breaking core boundaries.
This work is scheduled after the post-PR19 roadmap completes (after PR24).

### Scope

- super-admin-only access surface
- explicit authorization model
- full audit logging of access
- no exposure through:
  - APIs
  - UI
  - threads
  - artifacts
  - Slack/email/Jira adapters

### Hard Invariant

> Cognition debug is a narrow, audited exception — not the default read model.

### Validation

- CI scenario:
  - unauthorized access fails
  - authorized access logged and scoped correctly

### Status

❌ Not implemented

---

## Post-PR19 Roadmap (Do Not Implement Implicitly)

PR19 completes the product construction model and control loop.

The following work extends the system into real-world operation.
These are NOT part of PR19 and must be implemented as separate PRs.

---

## PR21A — Minimal Product UI (Visibility + Intervention)

First priority after PR19.

Provides:

- initiative list and creation
- initiative detail view
- product visibility summary (PR19G)
- task graph (read-first)
- intervention controls (PR19G)

Important:

> Without PR21A, the system is not usable by humans.
> This is the canonical surface for visibility and steering.

This phase does NOT require:

- deployment panels
- GitHub integration UI

---

## PR20 — Provider Adapters (Execution Realization)

- Create GitHub repository artifacts from task outputs
- Connect deployment records to provider adapters
- Implement Cloudflare Pages / Workers deployment adapters

Important:

> Providers execute deployments.
> AEP owns state and decisions.

Note:

PR20 enables **real product existence** (repo + deployment),
but does not replace AEP as the source of truth.

---

## PR21B — Full Product UI

Extends PR21A with:

- deployment panel
- repository view (GitHub mirror)
- artifact browser
- decision timeline refinement

Important:

> UI reflects AEP state. It does not own or mutate it directly.

---

## PR22 — External Mirroring (Jira)

- Mirror initiatives, tasks, decisions, deployments into Jira
- Ingest Jira comments/actions into AEP threads
- Maintain AEP as source of truth

### PR22 Jira Ingest Contract (MANDATORY)

Jira is a **mirror and conversation surface only**.

Allowed:

```text
Jira comment → AEP thread message
Jira mention → AEP thread message
Jira discussion → AEP coordination signal
```

Forbidden:

```text
Jira status change → AEP task status
Jira task creation → AEP task
Jira field mutation → AEP canonical state
Jira workflow transition → AEP execution change
```

Required flow:

```text
Jira action
  → AEP thread / message
  → (optional) task or approval created inside AEP
  → AEP decides state change
```

Invariant:

> Jira must never directly mutate AEP state.

---

## PR23 — Continuous Product Loop

- Validation failures generate follow-up tasks
- Customer intake feeds product evolution
- Monitoring/incidents create new work

### PR23 Signal Ingest Contract (MANDATORY)

External signals:

- monitoring alerts
- validation failures
- customer intake

Must NOT create tasks directly.

Required flow:

```text
signal
  → classification
  → intake OR thread
  → AEP creates tasks via canonical routes
```

Forbidden:

```text
signal → createTask ❌
```

Invariant:

> All new work must originate from AEP decisions, not external triggers.

---

## PR24 — Product Lifecycle

- Lifecycle states (active, deprecated, retired)
- Retirement workflows
- External surface shutdown
- Artifact and audit preservation

### PR24 Lifecycle Task-Gating Contract (MANDATORY)

Lifecycle transitions:

- pause
- resume
- retire
- transition

Must NOT be direct state mutations.

Required flow:

```text
lifecycle request
  → approval + task
  → decision
  → state transition
```

Forbidden:

```text
project.status = "paused" ❌
project.status = "retired" ❌
```

Invariant:

> Lifecycle is organizational work, not a state toggle.

---

Important invariant:

> Post-PR19 work must not introduce direct execution paths that bypass tasks, artifacts, approvals, or deployments.

---

# Critical Path

To reach a functioning operating company:

1. PR14 — Team operating loops  
2. PR15 — Project and intake model  
3. PR16 — Real team specialization  
4. PR17 — External collaboration adapters  

These four milestones enable:

> autonomous Web → Infra → Validation delivery loop

Post-PR19 roadmap (PR21A → PR20 → PR22 → PR23 → PR24) operationalizes
the system with UI, external adapters, and lifecycle management.
These must comply with the mandatory ingest and task-gating contracts.

---

# Guiding Principles

- AEP is an organization runtime, not a workflow engine
- canonical state lives in tasks, threads, artifacts, approvals, escalations
- employees are durable digital persons with private cognition
- Slack/email/Jira are adapters, not sources of truth
- UI is not a state owner
- authorship is immutable; responsibility may transfer
- private cognition must never leak into public surfaces

---

# 13. The next LLM session should:

1. read this file fully
2. inspect the repo at the target commit
3. trust the repo over this doc if they diverge
4. treat PR12 as complete
5. treat PR13, PR14, and PR15 as completed context; treat PR16 as the active next milestone unless repo state clearly shows later milestones in progress
6. use the roadmap in section 12.7 as the staged plan of record, and remove or update narrower milestone notes if they conflict with repo reality
7. preserve the cognition boundary while expanding employee embodiment and lifecycle
8. understand that the strategic goal is a real operating digital company with Web, Infra, Validation, PM, and later HR/staffing roles
9. prefer evolving team behavior and business-facing intake over inventing new primitives casually
10. preserve the rule that Slack/email/Jira-like systems are adapters, not the source of truth
11. treat any future super-admin cognition-debug surface as an explicit, narrow exception to the normal privacy boundary, never as the default read model

---

# 14. Final continuity note

Optimize for:

* canonicality
* legibility
* explicit governance
* bounded cognition
* human trust

The north star is:

> a real, observable, steerable digital company whose agents work independently through governed canonical surfaces, while humans can inspect, shape, and collaborate with them naturally across UI and external mirrors without losing canonicality.

