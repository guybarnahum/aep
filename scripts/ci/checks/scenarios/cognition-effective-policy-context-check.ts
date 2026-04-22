/* eslint-disable no-console */

import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "../../../../core/operator-agent/src/types";
import {
  derivePublicRationale,
  deriveThreadRationaleMessage,
  loadEmployeeCognitionInputForRun,
  thinkWithinEmployeeBoundary,
} from "../../../../core/operator-agent/src/lib/employee-cognition";

export {};

const CHECK_NAME = "cognition-effective-policy-context-check";
const CHECK_LABEL = "cognition effective policy context check";

const FORBIDDEN_PUBLIC_FIELDS = [
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
  "privateReasoning",
  "private_reasoning",
  "internalMonologue",
  "internal_monologue",
];

const PRIVATE_SCAFFOLD_TOKENS = [
  "PRIVATE ROLE SCAFFOLD",
  "PRIVATE EMPLOYEE SCAFFOLD",
  "role-seed-validation",
  "employee-seed-casey",
];

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);
  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function makeRunContext(): ResolvedEmployeeRunContext {
  return {
    request: {
      employeeId: "emp_val_specialist_01",
      roleId: "reliability-engineer",
      trigger: "manual",
      policyVersion: "ci-cognition-effective-policy-context-check",
      taskId: "task_validation_01",
    },
    employee: {
      identity: {
        employeeId: "emp_val_specialist_01",
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
      allowedServices: ["service_dashboard"],
    },
    budget: {
      maxActionsPerScan: 4,
      maxActionsPerHour: 20,
      maxActionsPerTenantPerHour: 5,
      tokenBudgetDaily: 500,
      runtimeBudgetMsPerScan: 700,
      verificationReadsPerAction: 2,
    },
    policyVersion: "ci-cognition-effective-policy-context-check",
    executionContext: {
      executionSource: "operator",
      actor: CHECK_NAME,
      taskId: "task_validation_01",
      receivedAt: Date.now(),
    },
    taskContext: {
      task: {
        id: "task_validation_01",
        companyId: "company_internal_aep",
        originatingTeamId: "team_infra",
        assignedTeamId: "team_validation",
        ownerEmployeeId: "emp_infra_ops_manager_01",
        assignedEmployeeId: "emp_val_specialist_01",
        createdByEmployeeId: "emp_infra_ops_manager_01",
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
      employeeId: "emp_val_specialist_01",
      state: "restricted",
      blocked: false,
      control: null,
      budgetOverride: {
        maxActionsPerScan: 4,
      },
    },
  };
}

function makeFakeEnv(): OperatorAgentEnv {
  const roleCatalogRow = {
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

  let capturedSystem = "";
  let capturedPrompt = "";

  const env = {
    AEP_AI_ENABLED: "true",
    AI: {
      async run(_model: string, inputs: Record<string, unknown>): Promise<unknown> {
        capturedSystem = String(inputs.system ?? "");
        capturedPrompt = String(inputs.prompt ?? "");
        return JSON.stringify({
          privateReasoning: "Use the restricted effective policy context while staying within bounded validation scope.",
          publicSummary: "Reviewed the task using bounded validation rationale.",
          structured: {
            intent: "execute_reliability_engineer",
            riskLevel: "medium",
            suggestedNextAction: "continue_with_explicit_task_flow",
          },
        });
      },
    },
    OPERATOR_AGENT_DB: {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            return {
              async first<T>(): Promise<T | null> {
                if (sql.includes("FROM employee_prompt_profiles")) {
                  return {
                    employee_id: bindings[0],
                    base_prompt: "PRIVATE EMPLOYEE SCAFFOLD",
                    decision_style: null,
                    collaboration_style: null,
                    identity_seed: "employee-seed-casey",
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
                    base_prompt_template: "PRIVATE ROLE SCAFFOLD",
                    decision_style: "analytical_and_evidence_first",
                    collaboration_style: "direct_and_operational",
                    identity_seed_template: "role-seed-validation",
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
                return { results: [] };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
    __captured: {
      get system(): string {
        return capturedSystem;
      },
      get prompt(): string {
        return capturedPrompt;
      },
    },
  } satisfies Partial<OperatorAgentEnv> & {
    __captured: {
      readonly system: string;
      readonly prompt: string;
    };
  };

  return env as OperatorAgentEnv;
}

async function main(): Promise<void> {
  const context = makeRunContext();
  const env = makeFakeEnv() as OperatorAgentEnv & {
    __captured: { readonly system: string; readonly prompt: string };
  };

  const cognitionInput = await loadEmployeeCognitionInputForRun(context, env);
  const cognition = await thinkWithinEmployeeBoundary(
    {
      ...cognitionInput,
      observations: ["Health check returned HTTP 503"],
    },
    env,
  );

  const rationale = derivePublicRationale(cognition);
  const threadMessage = deriveThreadRationaleMessage(rationale);

  assert(
    env.__captured.prompt.includes('Control: {"state":"restricted","blocked":false}'),
    `Expected effective control state in assembled prompt, got ${env.__captured.prompt}`,
  );
  assert(
    env.__captured.system.includes("PRIVATE ROLE SCAFFOLD")
      && env.__captured.system.includes("PRIVATE EMPLOYEE SCAFFOLD"),
    "Expected internal system prompt to include private scaffolds",
  );

  assertFieldsAbsent(cognition.publicSummary, FORBIDDEN_PUBLIC_FIELDS, "cognition.publicSummary");
  assertFieldsAbsent(rationale.summary, FORBIDDEN_PUBLIC_FIELDS, "public rationale summary");
  assertFieldsAbsent(rationale.rationale, FORBIDDEN_PUBLIC_FIELDS, "public rationale body");
  assertFieldsAbsent(threadMessage.body, FORBIDDEN_PUBLIC_FIELDS, "thread rationale message body");
  assertFieldsAbsent(
    {
      publicSummary: cognition.publicSummary,
      rationale,
      threadMessage,
    },
    PRIVATE_SCAFFOLD_TOKENS,
    "public cognition surfaces",
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    promptVersion: cognition.promptVersion,
    presentationStyle: cognition.presentationStyle,
    effectiveControlState: cognitionInput.additionalContext?.effectivePolicy?.control,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});