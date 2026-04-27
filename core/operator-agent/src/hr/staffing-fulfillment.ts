import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { createEmployee } from "@aep/operator-agent/persistence/d1/employee-lifecycle-store-d1";
import {
  getStaffingRequest,
  linkStaffingRequestFulfillment,
} from "@aep/operator-agent/persistence/d1/staffing-request-store-d1";
import type {
  EmployeeEmploymentStatus,
  EmployeePublicLink,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export type FulfillStaffingRequestInput = {
  employeeName: string;
  runtimeStatus?: "planned" | "active" | "disabled";
  employmentStatus?: EmployeeEmploymentStatus;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
  fulfilledByEmployeeId: string;
  effectiveAt?: string;
};

export async function fulfillStaffingRequest(
  env: OperatorAgentEnv,
  staffingRequestId: string,
  input: FulfillStaffingRequestInput,
): Promise<{
  ok: true;
  staffingRequestId: string;
  employeeId: string;
  employmentStatus: EmployeeEmploymentStatus;
  messageId?: string;
}> {
  const staffingRequest = await getStaffingRequest(env, staffingRequestId);
  if (!staffingRequest) {
    throw new Error(`Staffing request not found: ${staffingRequestId}`);
  }

  if (staffingRequest.state !== "approved") {
    throw new Error(
      `Only approved staffing requests can be fulfilled; got ${staffingRequest.state}`,
    );
  }

  const result = await createEmployee(env, {
    companyId: staffingRequest.companyId,
    teamId: staffingRequest.teamId,
    roleId: staffingRequest.roleId,
    employeeName: input.employeeName,
    runtimeStatus: input.runtimeStatus ?? "planned",
    employmentStatus: input.employmentStatus ?? "draft",
    schedulerMode: input.schedulerMode ?? "manual_only",
    bio: input.bio,
    tone: input.tone,
    skills: input.skills,
    avatarUrl: input.avatarUrl,
    appearanceSummary: input.appearanceSummary,
    birthYear: input.birthYear,
    publicLinks: input.publicLinks,
    createdByEmployeeId: input.fulfilledByEmployeeId,
    approvedBy: staffingRequest.ownership.approvedByEmployeeId,
    threadId:
      staffingRequest.source.kind === "thread"
        ? staffingRequest.source.threadId
        : undefined,
    effectiveAt: input.effectiveAt,
    reason: `Fulfilled staffing request ${staffingRequestId}`,
  });

  let messageId: string | undefined;
  if (staffingRequest.source.kind === "thread") {
    const store = getTaskStore(env);
    const message = await store.createMessage({
      id: `msg_staffing_fulfillment_${staffingRequestId}_${result.employeeId}`,
      companyId: staffingRequest.companyId,
      threadId: staffingRequest.source.threadId,
      senderEmployeeId: input.fulfilledByEmployeeId,
      type: "coordination",
      status: "pending",
      source: "system",
      subject: "Staffing request fulfilled",
      body: `Staffing request ${staffingRequestId} was fulfilled by creating employee ${result.employeeId}.`,
      payload: {
        staffingRequestId,
        fulfilledEmployeeId: result.employeeId,
        roleId: staffingRequest.roleId,
        teamId: staffingRequest.teamId,
      },
      requiresResponse: false,
    });
    messageId = message.id;
  }

  await linkStaffingRequestFulfillment(env, {
    id: staffingRequestId,
    employeeId: result.employeeId,
    messageId,
  });

  return {
    ok: true,
    staffingRequestId,
    employeeId: result.employeeId,
    employmentStatus: result.employmentStatus,
    messageId,
  };
}
