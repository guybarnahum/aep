import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { createEmployee } from "@aep/operator-agent/persistence/d1/employee-lifecycle-store-d1";
import {
  getImplementationBindingExecutor,
} from "@aep/operator-agent/lib/implementation-binding-registry";
import { getRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
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
  runtimeStatus?: "planned" | "implemented" | "disabled";
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

function employeeSpecString(
  spec: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = spec?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

async function assertFulfillmentRuntimeReady(args: {
  env: OperatorAgentEnv;
  roleId: string;
  teamId: string;
  employeeSpec?: Record<string, unknown>;
}): Promise<void> {
  const role = await getRoleCatalogEntry(args.env, args.roleId);
  if (!role) {
    throw new Error(`Unknown roleId: ${args.roleId}`);
  }
  if (role.teamId !== args.teamId) {
    throw new Error(`Role ${args.roleId} does not belong to team ${args.teamId}`);
  }

  const requiredBinding =
    employeeSpecString(args.employeeSpec, "implementationBindingRequired") ??
    role.implementationBinding;

  if (!role.runtimeEnabled) {
    throw new Error(
      `Role ${args.roleId} is not runtime enabled; enable role runtime before fulfillment`,
    );
  }

  if (!requiredBinding) {
    throw new Error(
      `Role ${args.roleId} is missing implementation binding; cannot fulfill runtime staffing request`,
    );
  }

  if (role.implementationBinding !== requiredBinding) {
    throw new Error(
      `Role ${args.roleId} implementation binding ${role.implementationBinding ?? "none"} does not match required binding ${requiredBinding}`,
    );
  }

  getImplementationBindingExecutor(requiredBinding);
}

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

  await assertFulfillmentRuntimeReady({
    env,
    roleId: staffingRequest.roleId,
    teamId: staffingRequest.teamId,
    employeeSpec: staffingRequest.employeeSpec,
  });

  const specRuntimeStatus = employeeSpecString(staffingRequest.employeeSpec, "runtimeStatus") as
    | "implemented"
    | "planned"
    | "active"
    | "disabled"
    | undefined;
  const specEmploymentStatus = employeeSpecString(
    staffingRequest.employeeSpec,
    "employmentStatus",
  ) as EmployeeEmploymentStatus | undefined;
  const specSchedulerMode = employeeSpecString(staffingRequest.employeeSpec, "schedulerMode");

  const result = await createEmployee(env, {
    companyId: staffingRequest.companyId,
    teamId: staffingRequest.teamId,
    roleId: staffingRequest.roleId,
    employeeName: input.employeeName,
    runtimeStatus: input.runtimeStatus ?? specRuntimeStatus ?? "implemented",
    employmentStatus: input.employmentStatus ?? specEmploymentStatus ?? "active",
    schedulerMode: input.schedulerMode ?? specSchedulerMode ?? "auto",
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
