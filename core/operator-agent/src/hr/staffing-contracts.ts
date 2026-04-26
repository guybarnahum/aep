import type { CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";
import type { AgentRoleId } from "@aep/operator-agent/types";

export type StaffingContractKind =
  | "job_description"
  | "staffing_request"
  | "hiring_recommendation"
  | "role_gap";

export type StaffingSource =
  | { kind: "task"; taskId: string }
  | { kind: "project"; projectId: string }
  | { kind: "thread"; threadId: string }
  | { kind: "role"; roleId: AgentRoleId }
  | { kind: "review"; reviewId: string }
  | { kind: "manager"; managerEmployeeId: string };

export type StaffingOwnership = {
  canonicalOwner: "aep";
  owningTeamId: TeamId;
  requestedByEmployeeId?: string;
  approvedByEmployeeId?: string;
  directEmployeeMutationAllowed: false;
  parallelHrDatabaseAllowed: false;
};

export type StaffingApprovalBoundary = {
  approvalRequired: boolean;
  approvalSurface: "canonical_approval" | "manager_review" | "advisory_only";
  directFulfillmentAllowed: false;
  employeeCreationRoute?: "POST /agent/employees";
  lifecycleRouteRequired?: boolean;
};

export type JobDescriptionState =
  | "draft"
  | "submitted"
  | "approved"
  | "superseded"
  | "archived";

export type StaffingRequestState =
  | "draft"
  | "submitted"
  | "approved"
  | "fulfilled"
  | "rejected"
  | "canceled";

export type HiringRecommendationState =
  | "draft"
  | "submitted"
  | "approved"
  | "applied"
  | "rejected"
  | "canceled";

export type RoleGapState =
  | "detected"
  | "acknowledged"
  | "request_created"
  | "resolved"
  | "dismissed";

export type JobDescriptionContract = {
  kind: "job_description";
  jobDescriptionId: string;
  companyId: CompanyId;
  roleId: AgentRoleId;
  teamId: TeamId;
  title: string;
  responsibilities: string[];
  successMetrics: string[];
  constraints: string[];
  source: StaffingSource;
  ownership: StaffingOwnership;
  state: JobDescriptionState;
  approval: StaffingApprovalBoundary;
};

export type StaffingRequestUrgency = "low" | "normal" | "high" | "critical";

export type StaffingRequestContract = {
  kind: "staffing_request";
  staffingRequestId: string;
  companyId: CompanyId;
  roleId: AgentRoleId;
  teamId: TeamId;
  reason: string;
  urgency: StaffingRequestUrgency;
  requestedByEmployeeId: string;
  source: StaffingSource;
  ownership: StaffingOwnership;
  state: StaffingRequestState;
  approval: StaffingApprovalBoundary;
};

export type HiringRecommendationContract = {
  kind: "hiring_recommendation";
  hiringRecommendationId: string;
  companyId: CompanyId;
  staffingRequestId: string;
  roleId: AgentRoleId;
  teamId: TeamId;
  recommendedEmployeeName?: string;
  rationale: string;
  source: StaffingSource;
  ownership: StaffingOwnership;
  state: HiringRecommendationState;
  approval: StaffingApprovalBoundary;
};

export type RoleGapReason =
  | "no_active_employee"
  | "required_role_missing"
  | "task_blocked_by_missing_role"
  | "employee_on_leave"
  | "employee_overloaded";

export type RoleGapContract = {
  kind: "role_gap";
  roleGapId: string;
  companyId: CompanyId;
  roleId: AgentRoleId;
  teamId: TeamId;
  reason: RoleGapReason;
  source: StaffingSource;
  ownership: StaffingOwnership;
  state: RoleGapState;
  approval: StaffingApprovalBoundary;
};

export type CanonicalStaffingContract =
  | JobDescriptionContract
  | StaffingRequestContract
  | HiringRecommendationContract
  | RoleGapContract;

export const STAFFING_CONTRACTS = [
  {
    kind: "job_description",
    canonicalIdField: "jobDescriptionId",
    lifecycleStates: ["draft", "submitted", "approved", "superseded", "archived"],
    sourceRequired: true,
    ownershipRequired: true,
    approvalBoundary: {
      approvalRequired: true,
      approvalSurface: "canonical_approval",
      directFulfillmentAllowed: false,
      lifecycleRouteRequired: true,
    },
  },
  {
    kind: "staffing_request",
    canonicalIdField: "staffingRequestId",
    lifecycleStates: ["draft", "submitted", "approved", "fulfilled", "rejected", "canceled"],
    sourceRequired: true,
    ownershipRequired: true,
    approvalBoundary: {
      approvalRequired: true,
      approvalSurface: "canonical_approval",
      directFulfillmentAllowed: false,
      employeeCreationRoute: "POST /agent/employees",
      lifecycleRouteRequired: true,
    },
  },
  {
    kind: "hiring_recommendation",
    canonicalIdField: "hiringRecommendationId",
    lifecycleStates: ["draft", "submitted", "approved", "applied", "rejected", "canceled"],
    sourceRequired: true,
    ownershipRequired: true,
    approvalBoundary: {
      approvalRequired: true,
      approvalSurface: "manager_review",
      directFulfillmentAllowed: false,
      employeeCreationRoute: "POST /agent/employees",
      lifecycleRouteRequired: true,
    },
  },
  {
    kind: "role_gap",
    canonicalIdField: "roleGapId",
    lifecycleStates: ["detected", "acknowledged", "request_created", "resolved", "dismissed"],
    sourceRequired: true,
    ownershipRequired: true,
    approvalBoundary: {
      approvalRequired: false,
      approvalSurface: "advisory_only",
      directFulfillmentAllowed: false,
    },
  },
] as const;

export function getStaffingContract(kind: StaffingContractKind) {
  return STAFFING_CONTRACTS.find((contract) => contract.kind === kind);
}
