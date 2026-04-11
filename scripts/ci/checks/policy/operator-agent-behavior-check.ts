/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import {
  getApprovalEntries,
  VALID_APPROVAL_STATES,
} from "../../contracts/approvals";
import {
  validateApprovalBehavior,
  validateEmployeeProjectionBehavior,
} from "../../shared/operator-agent-check-helpers";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("operator-agent-behavior-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const employees = employeesResponse.employees;
  for (const employee of employees) {
    validateEmployeeProjectionBehavior(employee);
  }

  const approvals = await client.listApprovals({ limit: 10 });
  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true");
  }

  const approvalEntries = getApprovalEntries(approvals);
  const validApprovalStates = new Set<string>(VALID_APPROVAL_STATES);

  for (const approval of approvalEntries) {
    validateApprovalBehavior(approval, validApprovalStates);
  }

  const pendingApprovals = approvalEntries.filter((approval) => {
    const state = approval.state ?? approval.status;
    return state === "pending_review" || state === "pending";
  });

  if (pendingApprovals.length > 0) {
    const approveExists = await client.endpointExists("/agent/approvals/approve");
    const rejectExists = await client.endpointExists("/agent/approvals/reject");

    if (!approveExists && !rejectExists) {
      throw new Error(
        "Neither /agent/approvals/approve nor /agent/approvals/reject endpoints are available",
      );
    }
  }

  console.log("operator-agent-behavior-check passed", {
    employeeCount: employeesResponse.count,
    approvalsCount: approvals.count,
    pendingApprovalsCount: pendingApprovals.length,
  });
}

main().catch((error) => {
  console.error("operator-agent-behavior-check failed");
  console.error(error);
  process.exit(1);
});