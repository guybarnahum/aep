# AEP — System State, Architecture, and Execution Plan

Repository (source of truth):
👉 https://github.com/guybarnahum/aep

The repository code is the source of truth.
This document is aligned to commit a646866828571fb4f09664b885b391df773f8aa4.

```bash
titan@Titans-MacBook-Pro aep % tree . --gitignore 

.
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
│   │   │   │   └── paperclip.ts
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
│   │   │   │   ├── approval-store-d1.ts
│   │   │   │   ├── budget-enforcer-d1.ts
│   │   │   │   ├── budget-enforcer.ts
│   │   │   │   ├── build-info.ts
│   │   │   │   ├── control-history-log-d1.ts
│   │   │   │   ├── cooldown-store-d1.ts
│   │   │   │   ├── cooldown-store.ts
│   │   │   │   ├── d1-ids.ts
│   │   │   │   ├── d1-json.ts
│   │   │   │   ├── decision-log.ts
│   │   │   │   ├── employee-catalog-store-d1.ts
│   │   │   │   ├── employee-control-store-d1.ts
│   │   │   │   ├── escalation-log-d1.ts
│   │   │   │   ├── escalation-state.ts
│   │   │   │   ├── execute-employee-run.ts
│   │   │   │   ├── execution-context.ts
│   │   │   │   ├── fallback-config.ts
│   │   │   │   ├── logger.ts
│   │   │   │   ├── manager-decision-log-d1.ts
│   │   │   │   ├── org-scope-resolver.ts
│   │   │   │   ├── paperclip-auth.ts
│   │   │   │   ├── policy-merge.ts
│   │   │   │   ├── policy.ts
│   │   │   │   ├── store-factory.ts
│   │   │   │   ├── store-types.ts
│   │   │   │   ├── task-store-d1.ts
│   │   │   │   ├── validate-paperclip-request.ts
│   │   │   │   ├── verifier.ts
│   │   │   │   ├── work-log-reader.ts
│   │   │   │   └── work-log-store-d1.ts
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
│   │   │   │   ├── employee-controls.ts
│   │   │   │   ├── employee-effective-policy.ts
│   │   │   │   ├── employee-scope.ts
│   │   │   │   ├── employees.ts
│   │   │   │   ├── escalations-acknowledge.ts
│   │   │   │   ├── escalations-resolve.ts
│   │   │   │   ├── escalations.ts
│   │   │   │   ├── healthz.ts
│   │   │   │   ├── manager-log.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── run-once.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── scheduler-status.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── thread-approval-actions.ts
│   │   │   │   ├── thread-delegate-task.ts
│   │   │   │   ├── thread-escalation-actions.ts
│   │   │   │   ├── te-seed-approval.ts
│   │   │   │   ├── te-seed-work-log.ts
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
│   │   │       └── 0016_thread_task_delegation.sql
│   │   └── wrangler
│   │       └── README.md
│   └── github
│       └── workflows
│           └── README.md
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
│   │   │   │   ├── employee-scope-check.ts
│   │   │   │   ├── escalation-thread-action-contract-check.ts
│   │   │   │   ├── operator-agent-contract-check.ts
│   │   │   │   ├── operator-surface-check.ts
│   │   │   │   ├── provider-provenance-check.ts
│   │   │   │   ├── runtime-projection-check.ts
│   │   │   │   ├── runtime-provenance-check.ts
│   │   │   │   ├── runtime-tenant-catalog-check.ts
│   │   │   │   ├── service-provider-check.ts
│   │   │   │   ├── thread-task-delegation-contract-check.ts
│   │   │   │   └── validate-runtime-read-safety.ts
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
│   │   │   │   ├── agent-timeout-recovery-check.ts
│   │   │   │   ├── approval-thread-delegation-check.ts
│   │   │   │   ├── check-validation-verdict.ts
│   │   │   │   ├── dispatch-validation-runs.ts
│   │   │   │   ├── escalation-thread-delegation-check.ts
│   │   │   │   ├── execute-validation-dispatch.ts
│   │   │   │   ├── execute-validation-work-order.ts
│   │   │   │   ├── multi-worker-department-check.ts
│   │   │   │   ├── paperclip-company-handoff-check.ts
│   │   │   │   ├── paperclip-first-execution-check.ts
│   │   │   │   ├── post-deploy-validation.ts
│   │   │   │   ├── run-recurring-validation.ts
│   │   │   │   ├── strategic-dispatch-test.ts
│   │   │   │   └── synthetic-failure-test.ts
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
│   │   ├── resolve-environment-urls.sh
│   │   ├── setup
│   │   ├── shared
│   │   │   ├── assert.ts
│   │   │   ├── env.ts
│   │   │   ├── http.ts
│   │   │   ├── operator-agent-check-helpers.ts
│   │   │   ├── service-map.ts
│   │   │   └── soft-skip.ts
│   │   ├── tasks
│   │   │   ├── poll.ts
│   │   │   ├── result-lines.ts
│   │   │   ├── retry.ts
│   │   │   ├── run-checks.ts
│   │   │   ├── run-observe.ts
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


⚠️ CI note:

The tree below is a repository inventory, not the architectural source of truth.

For CI and validation behavior, the canonical model is:

- layered reusable workflows
- five validation layers: environment, schema, contracts, policy, scenarios
- layered script layout under `scripts/ci/checks/...`
- URL contract based on `CONTROL_PLANE_BASE_URL` and `OPERATOR_AGENT_BASE_URL`

---

# What AEP Is

AEP is the **infra department of a zero-employee company**.

It is a system where:
- software systems act as employees
- teams exist as structured units
- decisions are governed and observable
- operations are executed through controlled interfaces

AEP can:
- deploy, validate, operate, and observe software
- enforce policy and escalate issues
- (eventually) improve itself

---

# System Layering

## Execution Layer
- Cloudflare Workers
- Durable Objects
- Async workflows
- D1 (state)

## AEP Layer (this repo)
> The **infra department**
- employees (agents)
- managers (supervision)
- policy + enforcement
- audit + governance
- execution surface

## Company Layer (future)
- org structure
- budgeting
- strategy
- coordination

---

# Evolution So Far

- **Commit 8**: First employee — from orchestration system to system with an actor
- **Commit 10–11**: Org emerges — employees, managers, escalation, governance; proto-organization
- **PR5**: Agentic shift — AI is not a feature, AI is the organization; agent identities, roles, cognitive positioning
- **PR6A**: Department surface + org seeding — company, teams, employee catalog, dashboard org view; system now models an organization, not just runtime agents

---

# 🔷 PR6B — Runtime Projection + Employee Boundary (COMPLETE)

**Major architectural milestone.**

## Goal
Make employees **first-class, bounded, encapsulated units**

## Employee Model (Canonical)
Each employee now has 3 layers:

### 1. Org-visible shell
`identity + runtime`
- employeeId, companyId, teamId, roleId
- runtimeStatus, effectiveState, effectiveBudget, effectiveAuthority

### 2. Public projection
`publicProfile`
- displayName, bio, skills, avatarUrl
- Used by dashboard, humans, org views

### 3. Private cognitive layer (NOT exposed)
- persona (bio, tone, skills — internal)
- prompt profile (`employee_prompt_profiles`)
- decision style, identity seed, reasoning (future), memory (future)

## Core Rule
> Cognition belongs INSIDE the employee

No global prompts, shared LLM state, or system-level reasoning.

## Canonical Contract
All employee APIs MUST return:
```ts
EmployeeProjection = {
  identity: {...}
  runtime: {...}
  publicProfile?: {...}
  hasCognitiveProfile: boolean
}
```

## Forbidden
Do NOT expose:
- basePrompt, decisionStyle, collaborationStyle, promptVersion, identitySeed, portraitPrompt
- legacy fields: catalog, scope, message, top-level authority/budget

## Runtime Semantics
| Field            | Meaning                |
|------------------|-----------------------|
| runtimeStatus    | structural presence   |
| effectiveState   | operational control   |
| effectiveAuthority | allowed actions     |
| effectiveBudget  | execution limits      |

## Cognitive Layer (New)
- `employee_prompt_profiles` table: base prompt, decision style, collaboration style, identity seed, portrait prompt, versioning, approval state
- NOT exposed in `/agent/employees`, owned by the employee boundary

## What PR6B Achieved
- canonical employee projection
- strict boundary enforcement
- dashboard aligned to projection
- no UI inference
- CI enforces contract
- no legacy field leakage
- cognitive layer formalized

---

# Where We Are Now

We have moved from:
> “agents as runtime features”
to:
> **employees as structured units in an organization**

This is the **foundational shift**.

---

# 🔷 PR6C — Company Coordination (CURRENT PR FAMILY)

## PR6C.2 — Task Dependencies & Orchestration

✅ IMPLEMENTED (core orchestration mechanics complete)

### Current implementation (repo-verified)

PR6C.2 is complete.

The system implements task-level orchestration with dependency awareness:

- Tasks support `dependsOnTaskIds`
- Dependencies are stored in `task_dependencies`
- Dependent tasks start as `blocked`
- `blockingDependencyCount` is tracked
- Completing a dependency releases blocked dependents to `ready`
- Scheduler executes only `queued` or `ready`

Dependency validation rejects:

- self-dependency
- duplicate dependency
- missing dependency
- cross-company dependency
- dependency cycle

This is all repo-verified in the task store and task types.

---

## PR6C.x — Task Artifacts

PR6 closeout added `task_artifacts`.

Artifact types are:

- `plan`
- `result`
- `evidence`

APIs:

- `POST /agent/tasks/:id/artifacts`
- `GET /agent/tasks/:id/artifacts`

`GET /agent/tasks/:id` now returns:

- `task`
- `dependencies`
- `artifacts`
- `decision`

Schema check requires `task_artifacts`.
Artifact contract check exists.

### Artifacts vs Decisions

- Decisions represent:
  → outcome and reasoning of task completion

- Artifacts represent:
  → structured outputs produced during or after execution

Artifacts are NOT:

- replacements for decisions
- internal monologue storage
- communication threads

They are:

👉 durable, inspectable work products

---

### IMPORTANT: Messages are coordination primitives

The system includes `employee_messages`, which support:

- coordination signals
- linking to tasks, escalations, approvals

However, this is NOT:

- inbox/outbox UX
- threaded conversations
- human-agent communication system

👉 Full communication systems are part of PR7

## Goal
Move from a modeled organization to an **operating organization**

## What We Add
1. Cross-team flows (e.g. Web → Infra → Validation)
  - task handoff, dependency tracking, execution chaining
2. Company scheduler
  - company-level loop, team coordination, workload distribution
3. Roadmap → execution linkage
  - roadmaps drive actions, tasks, execution flows
4. Inter-employee communication
  - structured messaging, persistence, org view visibility
5. Coordination primitives
  - task ownership, dependency graph, execution propagation, escalation across teams

## Updated interpretation
PR6C is now understood as the **coordination and work-structure layer**, not the full cognition layer.

That means PR6C should complete:
- task identity
- task routing
- task dependencies
- task graph orchestration
- scheduler awareness
- observable work structure

But PR6C should **not** absorb the full agent cognition and communication stack.

That next step is now defined as **PR7**.

---

# 🔷 PR6C.1 — Coordination Model Integration (COMPLETE)

## Summary

PR6C.1 completes the transition from:

> "task as a lightweight trigger"

to:

> "task as a first-class coordination primitive across the organization"

This is a foundational shift in AEP:
- Tasks now represent **intent + ownership + assignment**
- The system enforces **org-aware execution**
- CI/CD flows operate through **real employees and teams**

---

## What changed

### 1. Task creation contract (breaking change)

`POST /agent/tasks` now requires:

- `companyId`
- `originatingTeamId`
- `assignedTeamId`
- `taskType`
- `title`
- optional:
  - `createdByEmployeeId`
  - `assignedEmployeeId`
  - `payload`

This replaces the legacy:

- `teamId`
- implicit routing
- work-order abstraction

---

### 2. Task identity

- `taskId` is now the **primary identifier**
- `workOrderId` is deprecated and removed from CI paths

---

### 3. Task lifecycle (expanded)

Tasks now move through:

- `queued`
- `blocked`
- `ready`
- `in_progress`
- `completed`
- `failed`
- `escalated`

This reflects real organizational flow rather than execution-only state.

---

### 4. Execution model

Execution now happens via:

```text
task → /agent/run → employee → decision/verdict
```

Not:

```text
work order → run → result
```

---

### 5. CI/CD integration

Post-deploy validation now:

1. Creates a coordination task
2. Executes it via assigned employee
3. Waits for a decision/verdict

CI is now:

> an organizational workflow, not a direct system call

⚠️ Important:

If a reference uses:

`scripts/ci/<file>.ts`

for a validation check, it is likely outdated.

Validation scripts should be referenced from:

`scripts/ci/checks/<layer>/...`

---

## What this means (important)

AEP is no longer:

> "an agent runner with some metadata"

It is now:

> "an operating organization with tasks, ownership, and execution semantics"

This is the first point where:

- Teams matter
- Assignment matters
- Task routing matters
- Execution is no longer purely mechanical

---

# PR6C.2 — FINAL STATE

## Theme

> **Task orchestration and dependency awareness**

PR6C.1 introduced tasks.
PR6C.2 completed:

> **how tasks relate to each other and move through the org**

---

## Core goals

### 1. Task dependencies

Allow tasks to express:

- `dependsOnTaskIds: string[]`

Behavior:

- task enters `blocked` if dependencies not completed
- transitions to `ready` when dependencies resolve

---

### 2. Task graph (not just list)

We move from:

> flat task list

to:

> **task DAG (directed acyclic graph)**

This enables:

- workflows across teams
- chained validation
- escalation paths

---

### 3. Cross-team coordination

Tasks can now:

- originate from one team
- be assigned to another
- depend on a third

This formalizes:

> **inter-team contracts**

---

### 4. Scheduler awareness

Scheduler must:

- pick only `ready` tasks
- ignore `blocked`
- handle retries / escalation paths

---

### 5. Observability

Expose:

- dependency graph
- blocked reasons
- upstream/downstream relationships

---

## Implemented schema

- `task_dependencies`
- `task_artifacts`

## Implemented API surface

- `POST /agent/tasks`
- `GET /agent/tasks/:id`
- `POST /agent/tasks/:id/artifacts`
- `GET /agent/tasks/:id/artifacts`

---

## Constraints (DO NOT VIOLATE)

- Do NOT introduce orchestration engines outside the current model
- Do NOT bypass `/agent/tasks`
- Do NOT reintroduce work-order concepts
- All execution must still go through `/agent/run`

---

## Definition of Done (6C.2)

- Tasks can be created with dependencies
- Blocked tasks do not execute
- Tasks transition automatically when dependencies complete
- CI can model a multi-step validation flow using dependencies

This is now complete at the PR6 scope.

---

## After 6C.2 (updated)

Historically this doc previewed a possible PR6C.3 for:
- escalation policies
- manager intervention loops
- prioritization / scheduling heuristics

That remains directionally valid, but the current clarified plan is:

- move to **PR7**

This means PR6 should end in a structurally clean state before cognition is added.

---

## Mental model going forward

We are building:

> **a distributed organization, not a job queue**

Tasks are:

- contracts
- responsibilities
- units of coordination

Not just triggers.

---

# 🔷 PR6C.x — Minimal Addendum Before PR7: Task Artifacts

## Why this is needed

A key gap in the current PR6 model was that tasks had identity and lifecycle, but did not yet have a clean, durable, reviewable **artifact model**.

Without this, PR7 cognition would degenerate into:
- LLM outputs as transient strings
- no durable plans
- no durable results
- weak reviewability
- weak human observability

PR6 now includes that minimal primitive:

> **task artifacts**

This is not a redesign of PR6.  
It is a small but important completion of the coordination layer.

---

## Task artifact model

Every task may produce one or more artifacts:

- `plan`
- `result`
- `evidence`

### Implemented schema

```ts
TaskArtifact = {
  id: string
  taskId: string
  companyId: string
  artifactType: "plan" | "result" | "evidence"
  createdByEmployeeId?: string
  summary?: string
  content: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

---

## Why artifacts belong in late PR6, not PR7

Because artifacts are not cognition by themselves.

They are:
- work outputs
- execution structure
- review surfaces
- audit material

They make PR7 possible without smearing reasoning into unstructured logs.

---

## PR6 exit criteria

PR6 is complete when:

- org model exists
- employees are bounded
- tasks are first-class
- dependency orchestration works
- dependency validation is enforced
- scheduler respects blocking semantics
- tasks produce durable artifacts
- artifacts are accessible via API and task detail
- schema and contract checks enforce the model
- documentation matches repo reality

## PR6 Status

PR6 is COMPLETE.

The system now provides:

- organization structure (companies, teams, employees)
- task-based coordination
- dependency-aware orchestration
- validated task graph integrity
- durable task outputs (artifacts)
- stable API and CI enforcement

👉 This is a complete **organizational execution substrate**

PR7 begins at:

- cognition (reasoning loops)
- communication (inbox, threads, human interaction)
- delegation protocols

## PR7 Boundary (Do Not Cross in PR6)

PR6 intentionally does NOT include:

- inbox/outbox UX
- threaded conversations
- agent chat
- reasoning memory systems
- search or knowledge layers
- artifact editing/deleting
- UI overhaul

These belong to PR7.

---

# 🔷 PR6D — Documentation Lock

After PR6C:
- freeze architecture
- finalize README + LLM.md
- ensure no future re-interpretation needed

## Additional PR6D requirement

The CI / validation system is now part of the locked structural architecture.

That includes:
- reusable workflow layering
- layered script structure under `scripts/ci/checks/...`
- URL contract using `CONTROL_PLANE_BASE_URL` and `OPERATOR_AGENT_BASE_URL`
- removal of the legacy flat validation script model

## Updated interpretation

PR6D is still valid, but it now locks a slightly richer end-state:

- PR6A: org surface
- PR6B: employee boundary
- PR6C.1: coordination model integration
- PR6C.2: task dependencies and orchestration
- PR6C.x: task artifacts
- PR6D: documentation lock for the structural layer

PR6D should explicitly **not** attempt to absorb PR7 cognition work.

---

# 🔷 PR7 — Cognitive Execution + Communication Layer (ACTIVE PR FAMILY)

## Why PR7, not PR6E

This is now the preferred framing.

PR6 is about:
- structure
- bounded employees
- work coordination
- observable task flow

PR7 is about:
- cognition
- planning
- delegation
- communication
- natural human collaboration

This is a major architectural boundary.  
Cognition is not just another extension of coordination.  
It is a new axis.

So the next major phase should be:

> **PR7 — Cognitive Execution + Communication Layer**

---

## PR7 goal

Turn employees from:
> bounded executors with task assignment

into:
> **thinking, collaborating digital employees**

---

## PR7 pillars

### 1. Employee reasoning loop

Each `/agent/run` has now begun evolving toward:

1. load identity and runtime boundary
2. load assigned tasks
3. load dependencies + artifacts
4. emit durable `plan` / `result` artifacts
5. (next) load inbox / communication context
6. (next) invoke LLM
7. (next) emit:
  - private reasoning
  - messages
  - decisions
  - task updates
  - result artifacts
8. commit outputs
9. optionally notify humans through adapters
10. wait for next trigger

---

### 2. Internal canonical communication layer

AEP now has the first real internal communication substrate.

Implemented so far:
- internal inbox
- internal outbox
- message threads
- task-linked communication
- durable message history
- approval-linked threads
- escalation-linked threads
- thread-based human action messages

This exists **before** Slack/email mirroring and remains canonical.

AEP remains the source of truth for:
- work
- communication state
- plans
- decisions
- results

---

### 3. Planning and delegation

Employees, especially managers, should be able to:
- decompose goals into sub-tasks
- produce explicit plans
- assign tasks to employees or teams
- attach dependencies
- request approvals when needed

This turns teams into actual operating units.

Current status:
- thread-based human actions are implemented
- deterministic approval-thread flows are implemented
- conflict-visible thread history is implemented
- thread → follow-up task delegation is implemented
- delegated tasks preserve explicit provenance:
  - `sourceThreadId`
  - `sourceMessageId`
  - `sourceApprovalId`
  - `sourceEscalationId`
- delegation appends durable dashboard + system messages back into the source thread
- contracts and post-deploy workflows now include delegation coverage

---

### 4. Result publishing

Every meaningful task should produce durable result output:
- summary
- evidence
- linked artifacts
- reviewer context
- completion status

This now exists in minimal form through task artifacts:
- `plan`
- `result`
- `evidence`

and is already integrated into `/agent/run`.

---

### 5. Human observability and cooperation

Human collaboration must feel natural and seamless.

Humans should be able to:
- inspect tasks
- inspect assignments
- inspect plans
- inspect results
- comment
- review
- approve
- intervene
- subscribe to conversations

Implemented so far:
- inspect task detail
- inspect artifacts
- inspect approval/escalation threads
- approve/reject from thread
- acknowledge/resolve escalation from thread
- inspect durable message history for both applied and conflict paths

But humans should not need raw private chain-of-thought to understand the company.

---

### 6. Slack and email adapters

Slack and email remain **future adapters**, not the canonical substrate.

That means:
- messages/tasks/results originate in AEP
- selected threads are mirrored to Slack
- selected summaries/notifications are mirrored to email
- replies from Slack/email can be ingested back into AEP as structured messages

AEP stays canonical.

Slack/email become natural interfaces for:
- collaboration
- approvals
- notifications
- stakeholder visibility

---

## PR7 principles

### Principle 1
> Cognition stays inside the employee boundary

### Principle 2
> Communication is explicit and durable

### Principle 3
> Human cooperation must not require understanding hidden internal state

### Principle 4
> Slack/email are interfaces, not the company brain

### Principle 5
> Every important action should leave behind a legible artifact

---

## PR7 data model (directional)

### 1. Agent messages

```ts
AgentMessage = {
  messageId: string
  threadId: string
  senderEmployeeId?: string
  senderType: "employee" | "human" | "system" | "adapter"
  recipientEmployeeId?: string
  taskId?: string
  subject?: string
  body: string
  messageType: "assignment" | "question" | "status" | "review" | "approval" | "result" | "system"
  priority?: "low" | "normal" | "high"
  requiresResponse?: boolean
  source: "internal" | "slack" | "email" | "dashboard" | "system"
  createdAt: string
}
```

### 2. Message threads

```ts
MessageThread = {
  threadId: string
  topic: string
  taskId?: string
  createdByEmployeeId?: string
  visibility: "internal" | "org" | "public"
  createdAt: string
}
```

### 3. Task plans

```ts
TaskPlan = {
  planId: string
  taskId: string
  authorEmployeeId: string
  summary: string
  steps: Record<string, unknown>[]
  proposedAssignments?: Record<string, unknown>[]
  proposedDependencies?: string[]
  reviewStatus?: "draft" | "submitted" | "approved" | "rejected"
  createdAt: string
}
```

### 4. Task results

```ts
TaskResult = {
  resultId: string
  taskId: string
  authorEmployeeId: string
  summary: string
  content: Record<string, unknown>
  evidenceRefs?: string[]
  createdAt: string
}
```

### 5. Private reasoning artifacts

```ts
EmployeeReasoningArtifact = {
  reasoningId: string
  employeeId: string
  runId?: string
  taskId?: string
  summary: string
  content: Record<string, unknown>
  visibility: "private" | "reviewable"
  createdAt: string
}
```

These names are directional, not locked.  
The key architectural split is what matters:

- **public/reviewable work artifacts**
- **private/internal cognitive artifacts**

---

## PR7 execution pattern

### Worker employee
- reads assigned tasks
- reads inbox
- reasons
- executes or proposes
- emits result

### Manager employee
- receives goals
- reasons about decomposition
- emits plans
- creates child tasks
- assigns workers
- reviews outputs
- escalates or closes

This is how teams become real.

---

## PR7 human-facing observability layers

### Layer 1 — operational
Humans can see:
- tasks
- assignments
- statuses
- blockers
- messages
- approvals
- results

### Layer 2 — rationale
Humans can see:
- summarized reasoning
- plan rationale
- evidence used
- alternatives considered
- confidence

### Layer 3 — private cognition
Not exposed by default:
- internal monologue
- raw private reasoning
- latent prompt internals

This maintains safety and explainability together.

---

## PR7 expected adapters

### Slack
Best for:
- team coordination
- lightweight discussion
- alerts
- human-agent thread collaboration
- approval nudges

### Email
Best for:
- formal summaries
- stakeholder reporting
- approval records
- escalations
- periodic digests

Neither should become the source of truth.

---

## PR7 phased execution plan

### ✅ PR7.1 — cognitive execution loop
- `/agent/run` loads task context
- `/agent/run` writes `plan` / `result` artifacts
- task-backed execution is canonical
- public/private decision boundary is preserved

### ✅ PR7.2 — internal communication
- message threads
- inbox / outbox
- thread detail
- task/artifact-linked message model

### ✅ PR7.3 — human interaction threads
- approval-linked threads
- escalation-linked threads
- system lifecycle messages
- thread-enriched approval / escalation detail

### ✅ PR7.4 — contract hardening
- approval thread contract
- escalation thread contract
- linkage invariants

### ✅ PR7.5 — thread-based human actions
- approve / reject from thread
- acknowledge / resolve escalation from thread
- structured action metadata on messages

### ✅ PR7.6 — deterministic interaction hardening
- deterministic approval-thread seeding
- durable dashboard action messages for success + conflict
- approval thread action contracts now prove real first transition

### ✅ PR7.7 — thread → task delegation
- create follow-up tasks from approval/escalation thread outcomes
- link tasks to source thread + action message
- preserve provenance across delegation
- append durable delegation messages back into source threads
- expose delegated-task provenance through task detail
- add schema, contract, and scenario coverage

### ✅ PR7.75 / PR7.7X — delegation hardening
- wire delegation checks into reusable validation workflows
- remove unused delegation-support store surface
- fix delegation contract/scenario checks to avoid test-only seed endpoint assumptions
- use live approvals in reusable validation lanes where required
- soft-skip cleanly when suitable live approval/thread data is absent

### 🔜 PR7.8 — LLM-powered agents
- PR7.8A: cognition foundation
- shared prompt-profile-backed cognition service
- optional AI binding with deterministic fallback
- first normalization of cognition plumbing, not broad rollout
- no public exposure of private cognition; `executionContext` remains provenance-only
- PR7.8B: first broader employee reasoning rollout through the shared substrate

Repo reality note:
- proto-cognition already existed in `validation-agent` before consolidation
- `decisions.internal_monologue` already existed as private storage
- PR7.8A consolidates and hardens that existing boundary rather than introducing public cognition surfaces

### 🔜 PR7.9 — agents as persons
- stronger persona continuity
- identity / behavior consistency
- employee-specific voice and working style

### 🔜 PR7.10 — external communication adapters
- email bridge
- Slack bridge
- AEP remains source of truth; adapters mirror structured threads/messages

This is directional and may be compressed or regrouped, but the conceptual order is important.

---

# 🔮 Next Phase (Post PR6)

## Cognitive Execution Layer
Each employee will increasingly:
1. observe
2. reason (LLM)
3. emit: decisions, reasoning, messages, plans, results
4. act via control-plane APIs

Current state:
- tasks, artifacts, threads, approvals, escalations, and thread actions are in place
- LLM-powered reasoning is the next major capability, not yet fully implemented

## Future Additions
- internal monologue (private)
- memory system
- inter-agent messaging
- distributed reasoning
- learning loops

## Updated clarification
These items remain valid, but now map concretely to:
- PR7.7: delegation
- PR7.8: LLM-powered reasoning
- PR7.9: agents as persons
- PR7.10: Slack/email adapters

---

# 🚫 Constraints (Do NOT violate)
- no uncontrolled infra mutation
- UI is NOT source of truth
- no implicit state inference
- no exposure of cognitive internals
- no mixing public profile and internal persona
- no global LLM state

## Additional clarified constraints
- Slack must not become the source of truth
- Email must not become the source of truth
- Messaging must be explicit and persisted
- Plans/results must not disappear into transient logs
- Human observability must not require raw private cognition dumps

---

# ✅ Summary

AEP is now:
> a structured, observable, multi-team agentic company

PR6B ensured:
> employees are real, bounded units

PR6C ensures:
> the company actually operates across those units

PR7 will ensure:
> those employees actually think, collaborate, delegate, and produce legible work

- Durable Object orchestration
- D1-backed state
- job + attempt model
- async lifecycle (waiting → running → completed | failed)
- pause / resume

### 2. Operator-Agent Plane
- employee model
- escalations
- approvals
- manager log
- control history
- roadmaps
- scheduler status

### 3. Dashboard / Ops Console
- organization + governance visibility
- execution visibility (partial)

### 4. CI Plane
- deployment validation
- health checks
- operator surface checks
- org shape validation

---

# 3. PR5 → PR6 Transition

PR5 introduced:

> agents as employees

PR6 introduces:

> **organization as first-class runtime structure**

We are no longer modeling a few agents.

We are modeling:
- company
- teams
- employees
- managers
- governance
- coordination

## Updated interpretation
PR6 is now understood as the structural and coordination kernel of the organization.

PR7 will be the layer that makes those employees:
- reason
- plan
- communicate
- assign
- collaborate with humans naturally

---

# 4. Current State (POST PR6A / PR6B / PR6C.1, WITH PR6C.2 NEXT)

## ✅ PR6A — Completed

### What exists now

#### Organization model
- company
- teams:
  - infra
  - web-product
  - validation

#### Employees (mixed types)
- runtime employees (infra)
- catalog/planned employees (web + validation)

#### Operator-agent surface
- `/agent/employees`
- `/agent/escalations`
- `/agent/approvals`
- `/agent/control-history`
- `/agent/manager-log`
- `/agent/roadmaps`
- `/agent/scheduler-status`

#### Dashboard (department view)
- employees
- escalations
- approvals
- manager log
- control history
- roadmaps
- scheduler

#### CI
- org schema validation
- operator surface checks
- multi-team validation
- validation scripts are organized canonically under `scripts/ci/checks/{environment,schema,contracts,policy,scenarios}`

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
- `_validate_post_deploy.yml`

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

## ⚠️ Critical Reality

Employees now exist in two forms:

### 1. Runtime employees (implemented)
Have:
- effectiveState
- effectiveBudget
- effectiveAuthority

### 2. Catalog / planned employees
Have:
- catalog metadata
- scope
- optional persona

May NOT have:
- effectiveState
- runtime fields

👉 This broke the dashboard and revealed a deeper issue:

> the system lacks a **formal projection contract**

## Updated state note
That projection problem is the reason PR6B became foundational.  
The current clarified sequence is now:

- PR6A: org surface
- PR6B: employee boundary
- PR6C.1: tasks as coordination primitives
- PR6C.2: dependencies and orchestration
- PR6C.x: artifacts
- PR7: cognition + communication

---

# 5. Key Design Insight (Locked)

## 🧍 Employee = Encapsulated Unit

Each employee is:

> a **bounded entity with identity, cognition, and projection**

---

## Split the employee into 3 layers

### 1. Shell (org-visible)
- employeeId
- companyId
- teamId
- roleId
- runtimeStatus
- authority
- budget
- effectiveState

---

### 2. Public Profile (visible)
- displayName
- shortBio
- skills
- avatarUrl

---

### 3. Mind (private, encapsulated)
- base prompt
- tone / decision style
- identity seed
- memory (future)
- internal monologue (future)
- portrait generation prompt
- prompt version

---

## 🔒 Rule

> LLM + generative identity live **inside the employee**

NOT:
- global prompt registry
- shared persona system
- exposed raw cognitive state

System exposes:
- projections
- not internals

## Additional clarification
The employee mind should eventually produce:
- plans
- messages
- decisions
- result artifacts

But these outputs must be split into:
- **public/reviewable work products**
- **private/internal cognitive material**

That split is essential.

---

# 6. Observability-First Principle

Before deeper cognition:

> we must fully observe what already exists

The dashboard and ops-console must mirror:

### Levels of the system

1. Company
2. Teams
3. Employees
4. Governance
5. Execution
6. (future) Cognition

---

## Dashboard vs Ops Console

### Dashboard
- org view
- employees
- governance
- approvals
- escalations
- roadmap

### Ops Console
- runs / jobs / attempts
- trace
- execution debugging

They complement each other.

## Updated interpretation
As PR7 lands, observability should expand beyond execution-only traces into:
- task plans
- task results
- message threads
- rationale summaries
- human collaboration points

---

# 7. PR6 Plan

---

## ✅ 6A — Department Surface + Org Seeding (DONE)

- org exists in runtime + UI
- mixed employee types introduced
- dashboard + CI expanded

---

## ✅ 6B — Runtime Projection + Employee Boundary (COMPLETE)

### 🎯 Goal

Make employees:

> **well-defined, explicit, and bounded**

---

### Introduce canonical projection

```ts
EmployeeProjection = {
  identity: {
    employeeId
    companyId
    teamId
    roleId
  }

  runtime: {
    runtimeStatus: "implemented" | "planned" | "disabled"
    effectiveState?
    effectiveBudget?
    effectiveAuthority?
  }

  publicProfile?: {
    displayName
    bio
    skills
    avatarUrl
  }

  hasCognitiveProfile: boolean
}
```

---

### Requirements

#### 1. Backend must be explicit
- no missing-field inference
- runtimeStatus is REQUIRED

#### 2. UI must not guess
- no assumptions about effectiveState
- no implicit “planned” detection

#### 3. Cognitive layer exists but is hidden
- persona stored
- prompt stored
- NOT exposed by default

#### 4. CI enforces shape
- implemented employees → must have effectiveState
- planned employees → must not fake runtime fields

---

### Definition of Done (6B)

- stable employee API contract
- explicit runtimeStatus
- dashboard uses projection cleanly
- no UI crashes
- CI enforces structure

---

## 🔷 6C — Company Coordination

### Goal
Move from:

> teams exist

to:

> teams interact

---

### Introduce

- company-level orchestration
- cross-team flows
- roadmap → execution linkage

Example:
- Web → Infra → Validation

---

## Updated 6C definition

PR6C now means:
- tasks as first-class coordination primitives
- dependencies and orchestration
- scheduler awareness
- observable work graphs
- durable work artifacts

PR6C no longer means “full inter-employee messaging and LLM collaboration.”  
That is moved into PR7.

---

## 🔷 6D — Documentation Lock

- update README.md
- update LLM.md
- lock architecture and plan

Goal:
> no more reconstruction required

## Updated 6D note
This document update is part of that work: lock the structural understanding of PR6 and clearly establish PR7 as the cognition layer.

---

# 8. Future Phase — Cognition Layer

After observability + projection:

---

## Internal Monologue
- private
- stored in trace / memory
- used for explainability

---

## Inter-Employee Messaging
- explicit communication
- persisted
- visible in org views

---

## LLM Reasoning Loop

Each employee:

1. observes system state
2. reads messages
3. invokes LLM
4. outputs:
   - reasoning
   - internal_monologue
   - decisions
   - messages
   - plans
   - results
5. acts via control-plane APIs

---

## Updated interpretation
This “future phase” is now concretized as **PR7**.

Additional important rule:
- raw internal monologue should remain private by default
- human-facing observability should prefer rationale summaries and work artifacts

---

# 9. Constraints (DO NOT VIOLATE)

- no infra mutation inside Workers
- no UI as source of truth
- no implicit state inference
- no exposing full cognitive internals by default
- no mixing monologue and messaging
- no unauditable agent actions

## Additional constraints from the clarified plan

- do not make Slack the canonical task/message store
- do not make email the canonical task/message store
- do not let reasoning outputs live only in transient logs
- do not blur task assignment with free-form chat
- do not expose raw cognition when summarized rationale is sufficient

## CI constraints

- do not reintroduce flat CI validation entrypoints under `scripts/ci/*.ts`
- all new validation references must point directly to `scripts/ci/checks/<layer>/...`

---

## Updated immediate next step
👉 Start **PR7.8A — cognition foundation**

PR7.7 is complete, including delegation hardening.

Specifically, PR7.8A should:
1. add a shared cognition service inside the employee boundary
2. load private prompt profiles without exposing them on public routes
3. support optional AI invocation with deterministic fallback
4. normalize the validation agent onto that shared cognition path
5. establish foundation-only cognition plumbing without broad rollout yet
6. keep `executionContext` provenance-only and free of cognition leakage
7. continue emitting durable outputs through existing AEP primitives:
  - tasks
  - task artifacts
  - message threads
  - approvals / escalations when needed
8. keep Slack/email out of scope except as future adapters

PR7.8B should then expand real employee reasoning behavior beyond the initial foundation work.

---

# 11. Summary

AEP is now:

> a structured, observable, task-and-thread-based agentic organization

PR6 is complete.

PR7.1–PR7.7 are complete.

PR7.75 / PR7.7X hardening is complete.

The latest completed structural step is:

> enable delegation from threaded human interaction into new work with durable provenance

The next major steps are:

> make employees reason with LLMs, behave as persons, and communicate externally over email/Slack

Everything after that:
- LLM reasoning
- persona continuity
- inter-agent collaboration
- email / Slack adapters
- seamless human cooperation

depends on that foundation.

---

# 12. System Levels the UI Must Mirror

The dashboard and ops-console should converge toward reflecting the following levels.

## Level 1: Company
Questions the UI should answer:
- what company is this runtime representing?
- what teams exist?
- what is implemented vs planned?
- what is the active scheduler / governance posture?

## Level 2: Teams / departments
Questions:
- what teams exist?
- what roadmaps and objectives exist per team?
- what employees belong to each team?
- which teams are runtime-active vs catalog-only?

## Level 3: Employees
Questions:
- who are the employees?
- what role do they serve?
- what authority and budget do they have?
- what is their effective state?
- are they blocked, restricted, or planned?
- who manages them?

## Level 4: Governance and supervision
Questions:
- what escalations exist?
- what manager decisions were made?
- what approvals are pending or resolved?
- what control history exists for employees?

## Level 5: Work and execution
Questions:
- what runs, jobs, and attempts exist?
- how do they map to employees and departments?
- what traces and failure kinds are attached?

## Level 6: Cognition and communication
Questions:
- what reasoning led to actions?
- what internal monologue was produced?
- what messages were exchanged between employees?
- what evidence and context drove decisions?

This level is now partially implemented:
- message threads
- inbox/outbox
- approval/escalation threads
- thread-based human actions
- durable action history

Still missing:
- LLM-powered reasoning
- stronger persona continuity
- external communication adapters

## Updated Level 6 interpretation
Level 6 should eventually separate into:

### 6A. Reviewable cognition
- rationale summaries
- plans
- assignments
- results
- evidence

### 6B. Private cognition
- internal monologue
- raw reasoning traces
- prompt-level internals

This separation allows:
- explainability
- human trust
- auditability
- safer employee autonomy

without collapsing the employee boundary.

---

# 13. Canonical Communication Model (NEW)

## Decision
AEP should implement an internal canonical communication layer before relying on external systems like Slack or email.

This means each employee will eventually have, conceptually:

- inbox
- outbox
- task-linked message threads
- durable communication history

But these should first be modeled as AEP-native records.

## Why
Because otherwise:
- state fragments across systems
- audit trails weaken
- task and communication boundaries blur
- causality is lost

## Rule
> Slack/email are adapters to AEP communication, not replacements for it.

---

# 14. Human Collaboration Model (NEW)

## Goal
Human observability and cooperation should feel natural and seamless.

Humans should be able to:
- inspect work
- ask questions
- reply to messages
- review plans
- approve/reject
- follow threads
- receive summaries
- see results

without needing to inspect raw private cognition.

## Human-facing surfaces should emphasize
- task status
- assignments
- blockers
- message threads
- plans
- results
- rationale summaries
- escalation and approval state

---

# 15. Strategic framing (NEW)

AEP is not merely becoming:
> “a task execution system with LLM calls”

It is becoming:
> **an operating system for digital employees**

Its core primitives are converging toward:
- identity
- authority
- task
- message
- plan
- result
- approval
- escalation
- observability

The LLM is the reasoning engine inside this operating model, not the model itself.

---

# 16. Final locked phase structure (NEW)

## PR6 — Organization Kernel
- PR6A: Department surface + org seeding
- PR6B: Runtime projection + employee boundary
- PR6C.1: Coordination model integration
- PR6C.2: Dependencies and orchestration
- PR6C.x: Task artifacts
- PR6D: Documentation lock

## PR7 — Cognitive Organization
- PR7.1: Cognitive execution loop ✅
- PR7.2: Internal communication layer ✅
- PR7.3: Human interaction threads ✅
- PR7.4: Contract hardening ✅
- PR7.5: Thread-based human actions ✅
- PR7.6: Deterministic interaction hardening ✅
- PR7.7: Thread → task delegation ✅
- PR7.75 / PR7.7X: Delegation workflow + environment hardening ✅
- PR7.8A: Cognition foundation ⏭️
- PR7.8B: Broader shared-substrate reasoning rollout
- PR7.9: Agents as persons
- PR7.10: Email / Slack adapters

This is the current preferred framing and should be treated as the working plan unless code reality forces a concrete adjustment.

---

# 18. Current repo-aligned status (commit a646866828571fb4f09664b885b391df773f8aa4)

At this commit, the system supports:

- task-backed execution with durable `plan` / `result` / `evidence` artifacts
- message threads as canonical internal coordination substrate
- inbox / outbox / thread detail
- approval-linked and escalation-linked threads
- thread-based human actions
- deterministic approval-thread hardening
- explicit thread → task delegation with durable provenance on the task row:
  - `sourceThreadId`
  - `sourceMessageId`
  - `sourceApprovalId`
  - `sourceEscalationId`
- durable dashboard + system messages for delegation append-back into the source thread
- reusable workflow coverage for delegation contracts and post-deploy scenarios

Delegation validation has also been hardened for real environments:

- reusable validation lanes must not assume test-only seed endpoints
- delegation contract/scenario checks use live approvals where required
- these checks soft-skip cleanly when suitable live approval/thread data is absent

Important runtime rule:

> If `/agent/run` receives a `taskId`, that task must exist.

Important company rule:

> The canonical internal company is `company_internal_aep`.

---

# 19. Near-term direction for the next LLM session

The next LLM session should work from this order:

1. **PR7.8A — cognition foundation**
2. **PR7.8B — broader employee reasoning rollout**
3. **PR7.9 — agents as persons**
4. **PR7.10 — email / Slack adapters**

PR7.7, PR7.75, and PR7.7X should now be treated as complete.

Target end-state:

- agents powered by LLMs
- agents with stable person-like identity
- agents who communicate with humans and other agents
- Slack/email as adapters over AEP-native tasks, threads, approvals, escalations, and artifacts

---

# 17. Important continuity note (NEW)

This document intentionally preserves older planning language where useful, but the latest authoritative interpretation is:

1. **Do not redesign PR6 broadly**
2. **Finish PR6 cleanly with dependencies + artifacts**
3. **Move cognition and communication to PR7**
4. **Keep cognition inside the employee boundary**
5. **Keep AEP canonical even when Slack/email are added**
6. **Optimize for human observability through plans/results/messages, not raw hidden reasoning**
