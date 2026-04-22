import assert from "node:assert/strict";
import test from "node:test";
import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  RoleJobDescriptionProjection,
} from "@aep/operator-agent/types";
import {
  loadEmployeeCognitionInputForRun,
  thinkWithinEmployeeBoundary,
} from "./employee-cognition";

const EMPLOYEE_INFRA_OPS_MANAGER_ID = "emp_infra_mgr_01";
const EMPLOYEE_RELIABILITY_ENGINEER_ID = "emp_val_reliability_01";

type FakeD1ResultRow = Record<string, unknown>;

function makeRunContext(): ResolvedEmployeeRunContext {
  return {
    request: {
      employeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
      roleId: "reliability-engineer",
      trigger: "manual",
      policyVersion: "test-policy-v1",
      taskId: "task_validation_01",
    },
    employee: {
      identity: {
        employeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
        employeeName: "Casey Validation",
        companyId: "company_internal_aep",
        teamId: "team_validation",
        roleId: "reliability-engineer",
      },
      authority: {
        allowedOperatorActions: ["advance-timeout"],
        requireTraceVerification: true,
      },
      budget: {
        maxActionsPerScan: 10,
        maxActionsPerHour: 20,
        maxActionsPerTenantPerHour: 5,
        tokenBudgetDaily: 1000,
        runtimeBudgetMsPerScan: 1000,
        verificationReadsPerAction: 2,
      },
      escalation: {
        onBudgetExhausted: "log",
        onRepeatedVerificationFailure: "notify-human",
        onProdTenantAction: "require-manager-approval",
      },
    },
    authority: {
      allowedOperatorActions: ["advance-timeout"],
      requireTraceVerification: true,
    },
    budget: {
      maxActionsPerScan: 8,
      maxActionsPerHour: 20,
      maxActionsPerTenantPerHour: 5,
      tokenBudgetDaily: 900,
      runtimeBudgetMsPerScan: 900,
      verificationReadsPerAction: 2,
    },
    policyVersion: "test-policy-v1",
    executionContext: {
      executionSource: "operator",
      actor: "employee-cognition-test",
      taskId: "task_validation_01",
      receivedAt: Date.now(),
    },
    taskContext: {
      task: {
        id: "task_validation_01",
        companyId: "company_internal_aep",
        originatingTeamId: "team_infra",
        assignedTeamId: "team_validation",
        ownerEmployeeId: EMPLOYEE_INFRA_OPS_MANAGER_ID,
        assignedEmployeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
        createdByEmployeeId: EMPLOYEE_INFRA_OPS_MANAGER_ID,
        taskType: "validate-deployment",
        title: "Validate deployment",
        status: "ready",
        payload: {
          targetUrl: "https://example.com",
        },
        blockingDependencyCount: 0,
      },
      dependencies: [],
      artifacts: [],
    },
    effectiveControl: {
      employeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
      state: "restricted",
      blocked: false,
      control: null,
      budgetOverride: {
        maxActionsPerScan: 8,
      },
    },
  };
}

function makeFakeEnv(): OperatorAgentEnv {
  const roleCatalogRow: FakeD1ResultRow = {
    role_id: "reliability-engineer",
    title: "Reliability Engineer",
    team_id: "team_validation",
    employee_id_code: "qa",
    runtime_enabled: 1,
    implementation_binding: "validation-agent",
    manager_role_id: "infra-ops-manager",
    job_description_text: "Execute bounded validation work using explicit evidence.",
    responsibilities_json: JSON.stringify([
      "Validate deployments",
      "Publish bounded rationale",
    ]),
    success_metrics_json: JSON.stringify([
      "High-signal validation results",
    ]),
    constraints_json: JSON.stringify([
      "Do not exceed approved scope",
    ]),
    seniority_level: "individual_contributor",
  };

  const env = {
    OPERATOR_AGENT_DB: {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            return {
              async first<T>(): Promise<T | null> {
                if (sql.includes("FROM employee_prompt_profiles")) {
                  return {
                    employee_id: bindings[0],
                    base_prompt: "Employee private scaffold",
                    decision_style: "clear_and_alignment_driven",
                    collaboration_style: null,
                    identity_seed: "casey|validation",
                    portrait_prompt: null,
                    prompt_version: "employee-v1",
                    status: "approved",
                    created_at: "2026-04-22T00:00:00.000Z",
                    updated_at: "2026-04-22T00:00:00.000Z",
                  } as T;
                }

                if (sql.includes("FROM role_prompt_profiles")) {
                  return {
                    role_id: bindings[0],
                    base_prompt_template: "Role private scaffold",
                    decision_style: "analytical_and_evidence_first",
                    collaboration_style: "direct_and_operational",
                    identity_seed_template: "role|validation",
                    prompt_version: "role-v1",
                    status: "approved",
                    created_at: "2026-04-22T00:00:00.000Z",
                    updated_at: "2026-04-22T00:00:00.000Z",
                  } as T;
                }

                if (sql.includes("FROM roles_catalog")) {
                  return roleCatalogRow as T;
                }

                return null;
              },
              async all<T>(): Promise<{ results?: T[] }> {
                if (sql.includes("FROM role_review_dimensions")) {
                  return { results: [] };
                }

                return { results: [] };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
  } satisfies Partial<OperatorAgentEnv>;

  return env as OperatorAgentEnv;
}

test("loadEmployeeCognitionInputForRun hydrates prompt profiles, role contract, and effective policy", async () => {
  const context = makeRunContext();
  const env = makeFakeEnv();

  const input = await loadEmployeeCognitionInputForRun(context, env);

  assert.equal(input.employee.employeeId, EMPLOYEE_RELIABILITY_ENGINEER_ID);
  assert.equal(input.promptProfile?.promptVersion, "employee-v1");
  assert.equal(input.rolePromptProfile?.promptVersion, "role-v1");
  assert.equal(input.roleContract?.roleId, "reliability-engineer");
  assert.equal(input.roleContract?.implementationBinding, "validation-agent");
  assert.deepEqual(input.additionalContext?.effectivePolicy?.authority, context.authority);
  assert.deepEqual(input.additionalContext?.effectivePolicy?.budget, context.budget);
  assert.deepEqual(input.additionalContext?.effectivePolicy?.control, {
    state: "restricted",
    blocked: false,
  });
});

test("thinkWithinEmployeeBoundary falls back to role prompt profile styles when employee prompt style is absent", async () => {
  const result = await thinkWithinEmployeeBoundary({
    employee: {
      employeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
      employeeName: "Casey Validation",
      companyId: "company_internal_aep",
      teamId: "team_validation",
      roleId: "reliability-engineer",
    },
    promptProfile: null,
    rolePromptProfile: {
      roleId: "reliability-engineer",
      basePromptTemplate: "Role private scaffold",
      decisionStyle: "analytical_and_evidence_first",
      collaborationStyle: "direct_and_operational",
      identitySeedTemplate: "role|validation",
      promptVersion: "role-v1",
      status: "approved",
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
    },
    roleContract: {
      roleId: "reliability-engineer",
      title: "Reliability Engineer",
      teamId: "team_validation",
      jobDescriptionText: "Execute bounded validation work using explicit evidence.",
      responsibilities: ["Validate deployments"],
      successMetrics: ["High-signal validation results"],
      constraints: ["Stay in scope"],
      seniorityLevel: "individual_contributor",
    } satisfies RoleJobDescriptionProjection,
    taskContext: makeRunContext().taskContext,
    observations: ["Health check failed with status 503"],
  });

  assert.equal(result.mode, "fallback");
  assert.equal(result.presentationStyle, "operational_evidence");
  assert.equal(result.promptVersion, "role-v1");
  assert.equal(result.structured?.intent, "execute_reliability_engineer");
  assert.match(
    result.publicSummary,
    /Reviewed the task using an evidence-first operational assessment\./,
  );
});