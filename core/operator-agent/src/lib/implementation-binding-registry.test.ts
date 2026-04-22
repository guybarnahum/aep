import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedEmployeeRunContext } from "@aep/operator-agent/types";
import { getImplementationBindingExecutor } from "./implementation-binding-registry";

function makeRunContext(
  roleId: ResolvedEmployeeRunContext["employee"]["identity"]["roleId"],
): ResolvedEmployeeRunContext {
  return {
    request: {
      employeeId: "test-employee",
      roleId,
      trigger: "manual",
      policyVersion: "test-policy-v1",
    },
    employee: {
      identity: {
        employeeId: "test-employee",
        employeeName: "Test Employee",
        companyId: "company_internal_aep",
        teamId:
          roleId === "reliability-engineer" ||
          roleId === "validation-engineer" ||
          roleId === "validation-pm"
            ? "team_validation"
            : roleId === "product-manager" ||
                roleId === "product-manager-web" ||
                roleId === "frontend-engineer"
              ? "team_web_product"
              : "team_infra",
        roleId,
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
      maxActionsPerScan: 10,
      maxActionsPerHour: 20,
      maxActionsPerTenantPerHour: 5,
      tokenBudgetDaily: 1000,
      runtimeBudgetMsPerScan: 1000,
      verificationReadsPerAction: 2,
    },
    policyVersion: "test-policy-v1",
  };
}

test("getImplementationBindingExecutor resolves approved bindings", () => {
  assert.equal(
    typeof getImplementationBindingExecutor("timeout-recovery-worker"),
    "function",
  );
  assert.equal(
    typeof getImplementationBindingExecutor("infra-ops-manager"),
    "function",
  );
  assert.equal(
    typeof getImplementationBindingExecutor("validation-agent"),
    "function",
  );
  assert.equal(
    typeof getImplementationBindingExecutor("pm-agent"),
    "function",
  );
});

test("getImplementationBindingExecutor fails closed for unknown bindings", () => {
  assert.throws(
    () => getImplementationBindingExecutor("totally-unknown-binding"),
    /Unknown implementation_binding: totally-unknown-binding/,
  );
});

test("binding executors fail closed on unsupported role/binding combinations", async () => {
  const timeoutExecutor = getImplementationBindingExecutor(
    "timeout-recovery-worker",
  );
  await assert.rejects(
    () => timeoutExecutor(makeRunContext("reliability-engineer")),
    /Implementation binding timeout-recovery-worker does not support roleId reliability-engineer/,
  );

  const validationExecutor = getImplementationBindingExecutor(
    "validation-agent",
  );
  await assert.rejects(
    () => validationExecutor(makeRunContext("product-manager")),
    /Implementation binding validation-agent does not support roleId product-manager/,
  );

  const pmExecutor = getImplementationBindingExecutor("pm-agent");
  await assert.rejects(
    () => pmExecutor(makeRunContext("infra-ops-manager")),
    /Implementation binding pm-agent does not support roleId infra-ops-manager/,
  );
});