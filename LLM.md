# AEP — System State, Canonical Architecture, and Next Work

Repository (source of truth):  
👉 https://github.com/guybarnahum/aep

The repository code is the source of truth.  
This document is aligned to commit `7c4a6af9cdf1c2de4b04aa1bf9fb30d6f9fd3695`.

Endpoint documentation note for future LLM sessions:

- HTTP endpoint documentation is centralized in `API.md` at this commit
- treat `API.md` as the canonical API reference before inferring routes from scattered docs
- if the repo later renames `API.md` or `APII.md`, use that renamed file as the same canonical API reference
- use `LLM.md` for architecture, continuity, and task context; use `API.md` for concrete route surfaces and invariants
- runtime-facing checks should resolve live employee instances from `/agent/employees` by role/team intent instead of assuming seeded employee ids
- CI live employee resolution should prefer semantic requirements over seeded-identity assumptions: use role/team/runtime as the initial candidate set, then filter by required scope properties, expected role metadata, or explicit behavior-based matchers as needed
- schema and surface checks should prefer role-oriented invariants over seeded-id assertions where practical
- `scripts/ci/shared/employee-ids.ts` must not exist; CI checks should resolve live employee ids by role/team from `/agent/employees` or use local fixture ids only for pure unit-style checks that do not depend on seeded runtime employees
- staging and production contracts validation must not create synthetic employees
- synthetic employee lifecycle/persona mutation checks belong only in the async-validation lane
- async-validation may enable `ENABLE_TEST_ENDPOINTS=true` and purge synthetic employees after mutation checks complete

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
│       ├── _validate_post_deploy.yml
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

## PR13G — Hardening + policy + realism pass (COMPLETED)

Implemented:

* lifecycle invariant hardening for invalid transition combinations
* stronger review-policy realism checks on cycle status, evidence existence, and high-impact recommendation approval
* expanded CI negative-case coverage for lifecycle and review invariants
* company-view copy tightening so people-management terminology is consistent
* LLM.md tree/state refresh to match the repo more closely
* synthetic purge now exists as a narrowly scoped cleanup/admin surface for `is_synthetic = true` and `employment_status = archived`
* authorization may come from `ENABLE_TEST_ENDPOINTS=true` or an explicit cleanup token

Important invariant:

* archived employees are not a generic active lifecycle target
* reviews may only be created against active review cycles
* review evidence must point to canonical tasks, artifacts, or threads that exist
* high-impact review recommendations remain explicit and approval-linked
* only `is_synthetic = true` employees may be permanently purged
* purge additionally requires `employment_status = archived`
* purge authorization is allowed either through `ENABLE_TEST_ENDPOINTS=true` or an explicit cleanup token
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

# 13. The next LLM session should:

1. read this file fully
2. inspect the repo at the target commit
3. trust the repo over this doc if they diverge
4. treat PR12 as complete
5. treat PR13 as the active next phase
6. treat PR13A through PR13G as complete in the repo state reflected here, and only start a new PR13.x milestone after checking current code:
   * PR13A
   * PR13B
   * PR13C
   * PR13D
   * PR13E
   * PR13F
   * PR13G
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

