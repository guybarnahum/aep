# AEP — System State, Canonical Architecture, and Next Work

Repository (source of truth):  
👉 https://github.com/guybarnahum/aep

The repository code is the source of truth.  
This document is aligned to commit `75388c71962738dbcf3e852353a0d44336c50e6f`.

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
│   │   │   │   ├── employee-cognition.ts
│   │   │   │   ├── employee-control-store-d1.ts
│   │   │   │   ├── employee-prompt-profile-store-d1.ts
│   │   │   │   ├── employee-work-loop.ts
│   │   │   │   ├── escalation-log-d1.ts
│   │   │   │   ├── escalation-state.ts
│   │   │   │   ├── execute-employee-run.ts
│   │   │   │   ├── execution-context.ts
│   │   │   │   ├── fallback-config.ts
│   │   │   │   ├── human-interaction-threads.ts
│   │   │   │   ├── human-visibility-summary.ts
│   │   │   │   ├── logger.ts
│   │   │   │   ├── manager-decision-log-d1.ts
│   │   │   │   ├── org-resolver.ts
│   │   │   │   ├── org-scope-resolver.ts
│   │   │   │   ├── paperclip-auth.ts
│   │   │   │   ├── policy-merge.ts
│   │   │   │   ├── policy.ts
│   │   │   │   ├── rationale-thread-publisher.ts
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
│   │   │   │   ├── escalation-detail.ts
│   │   │   │   ├── escalations-acknowledge.ts
│   │   │   │   ├── escalations-resolve.ts
│   │   │   │   ├── escalations.ts
│   │   │   │   ├── healthz.ts
│   │   │   │   ├── manager-log.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── run-once.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── scheduler-status.ts
│   │   │   │   ├── task-artifacts.ts
│   │   │   │   ├── tasks.ts
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
│   │   │       └── 0021_external_interaction_policy.sql
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
│   │   │   │   ├── repeated-pm-persona-continuity-check.ts
│   │   │   │   ├── repeated-validation-persona-continuity-check.ts
│   │   │   │   ├── run-recurring-validation.ts
│   │   │   │   ├── strategic-dispatch-test.ts
│   │   │   │   ├── synthetic-failure-test.ts
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

---

# 1. What AEP is

AEP is the **infra department kernel of a zero-employee company**.

It is not:
- a chatbot
- a generic workflow engine
- a Slack-native or email-native system
- a stateless LLM wrapper

It is:
- an organization runtime
- a governed task/thread/artifact system
- a home for bounded digital employees
- a canonical substrate for planning, execution, validation, governance, and human interaction

The key idea is:

> AEP is canonical.  
> Tasks, threads, artifacts, approvals, escalations, and external mappings live in AEP.  
> Slack and email are adapters over that canonical state.

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

### Approvals and escalations
Approvals and escalations are explicit governance primitives.  
They are not hidden side effects or implicit message semantics.

### External mappings
Slack/email mirroring, external thread mappings, inbound replies, and explicit external actions are projections and interaction surfaces layered on top of canonical AEP threads/messages.

---

# 3. Hard rules

## Canonicality
- AEP is canonical
- tasks are canonical work state
- threads are canonical communication state
- artifacts are canonical durable outputs
- approvals and escalations are canonical governance state

## Cognition boundary
- LLM cognition stays inside the employee boundary
- no raw private reasoning on public routes
- no prompt-profile leakage
- no route-level free-form cognition generation
- no shared company-wide hidden “mind”

## Work model
- work happens through tasks, artifacts, threads, approvals, and escalations
- not through free-form chat as the primary model
- not through transient logs
- not through Slack/email as source of truth

## Human control
Humans must be able to:
- inspect work
- inspect plans
- inspect results
- inspect validation outputs
- inspect approvals/escalations
- participate through canonical threads
- intervene explicitly

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

Important runtime rules:

- if `/agent/run` receives a `taskId`, that task must exist
- canonical company is `company_internal_aep`

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
<!-- END: docs/ci-mental-model.md -->

---

# 8. Current product gap

The backend substrate is now ahead of the UI.

AEP can already:

* create plans
* create child tasks
* emit validation artifacts
* publish bounded rationale
* mirror external messages
* ingest replies/actions
* expose visibility summaries

But the human-facing product still under-represents this.

What is missing most now is:

> a first-class UI and human collaboration layer that makes the independent agentic work legible, navigable, and steerable.

This is the right next step.

---

# 9. PR12 — Agentic Company UI + Human Collaboration Surfaces

## Goal

Expose the governed agentic work already happening in AEP through:

* dashboard / ops-console UI
* canonical thread/task/plan/result views
* embodied employee profiles
* human interjection and participation
* visible external mirrors (Slack/email) as adapters over canonical state

PR12 should make it possible for a human to observe:

* what agents are planning
* how tasks are decomposed
* what artifacts they produced
* what validation concluded
* what was deployed / monitored
* where approvals / escalations are waiting
* how external mirrors relate back to canonical work

And it should make it possible for a human to:

* open threads
* reply/interject
* shape agent behavior through canonical messages and governance surfaces
* review plans and outcomes
* understand “who did what and why” without seeing raw private cognition

## PR12 scope

### PR12A — UI foundation for canonical work surfaces

* task detail UI for plans / results / evidence / validation
* thread detail UI for canonical discussions and rationale publication
* visibility-summary-driven panels
* no UI-as-source-of-truth behavior

### PR12B — embodied employees and organization presence

* employee cards / directory / profile views
* public photo / bio / skills usage
* team-level and company-level views of active work

### PR12C — human interjection and collaboration

* send canonical messages into task-linked threads
* let humans shape work through threads, not hidden prompts
* keep approvals/escalations explicit

### PR12D — external mirror visibility

* show Slack/email projection state in UI
* show external thread mapping and audit clearly
* keep mirrors visibly secondary to canonical AEP state

### PR12E — work theater / company activity view

* “what the company is doing now”
* plans underway
* execution in progress
* validation outcomes
* governance bottlenecks
* external collaboration state

## PR12 must not do

* must not make Slack/email canonical
* must not expose raw private reasoning
* must not bypass tasks/threads/artifacts
* must not turn UI into write-through hidden state mutation
* must not reintroduce chat as the primary work model

---

# 10. After PR12

## PR13 — Multi-agent operational company

Likely scope:

* richer multi-agent coordination
* cross-team consensus and negotiation on “what”
* manager / worker / validator loops across multiple concurrent tasks
* governed company-wide operating behavior

---

# 11. Near-term next session guidance

The next LLM session should:

1. read this file fully
2. inspect the repo at the target commit
3. trust the repo over this doc if they diverge
4. treat PR11 as complete
5. begin PR12 as the UI + human collaboration + mirror visibility phase

Priority order:

1. canonical UI surfaces over existing task/thread/artifact APIs
2. human interjection through canonical message threads
3. employee embodiment / profile surfacing
4. external mirror visibility in UI
5. only after that, deeper multi-agent collaboration mechanics

---

# 12. Final continuity note

Optimize for:

* canonicality
* legibility
* explicit governance
* bounded cognition
* human trust

The north star is:

> a real, observable, steerable digital company whose agents work independently through governed canonical surfaces, while humans can inspect, shape, and collaborate with them naturally.

