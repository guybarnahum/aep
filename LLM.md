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
│   │   │       └── 0011_operator_agent_coordination.sql
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
│   │   ├── agent-timeout-recovery-check.ts
│   │   ├── apply-d1-migrations.sh
│   │   ├── approval-state-machine-check.ts
│   │   ├── async-deploy-check.ts
│   │   ├── check-health.ts
│   │   ├── check-operator-agent-coordination-schema.sh
│   │   ├── check-validation-policy.ts
│   │   ├── check-validation-verdict.ts
│   │   ├── company-coordination-schema-check.ts
│   │   ├── create-preview-wrangler-config.sh
│   │   ├── destroy-preview-resources.sh
│   │   ├── dispatch-validation-runs.ts
│   │   ├── employee-scope-check.ts
│   │   ├── ensure-d1-database.sh
│   │   ├── escalation-audit-check.ts
│   │   ├── escalation-lifecycle-check.ts
│   │   ├── execute-validation-dispatch.ts
│   │   ├── execute-validation-work-order.ts
│   │   ├── free-leaked-resources.sh
│   │   ├── generate-build-meta.sh
│   │   ├── manager-advisory-check.ts
│   │   ├── manager-policy-overlay-check.ts
│   │   ├── multi-worker-department-check.ts
│   │   ├── operator-action-check.ts
│   │   ├── operator-agent-org-schema-check.ts
│   │   ├── operator-surface-check.ts
│   │   ├── org-inventory-route-check.ts
│   │   ├── org-schema-check.ts
│   │   ├── paperclip-company-handoff-check.ts
│   │   ├── paperclip-first-execution-check.ts
│   │   ├── post-deploy-validation.ts
│   │   ├── provider-provenance-check.ts
│   │   ├── resolve-environment-urls.sh
│   │   ├── run-recurring-validation.ts
│   │   ├── runtime-projection-check.ts
│   │   ├── runtime-provenance-check.ts
│   │   ├── runtime-tenant-catalog-check.ts
│   │   ├── scheduled-routing-check.ts
│   │   ├── service-provider-check.ts
│   │   ├── smoke-test.ts
│   │   ├── stage127-runtime-matrix.mjs
│   │   ├── strategic-dispatch-test.ts
│   │   ├── synthetic-failure-test.ts
│   │   ├── validate-runtime-read-safety.ts
│   │   └── wait-for-url.ts
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
