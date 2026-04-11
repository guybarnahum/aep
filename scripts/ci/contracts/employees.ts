export type EmployeeRuntimeStatus = "implemented" | "planned" | "disabled";

export type EmployeeControlState =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

export type EmployeeIdentity = {
  employeeId: string;
  roleId: string;
  companyId: string;
  teamId: string;
};

export type EmployeeAuthority = {
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  requireTraceVerification?: boolean;
  [key: string]: unknown;
};

export type EmployeeBudget = {
  maxActionsPerScan?: number;
  [key: string]: unknown;
};

export type EffectiveState = {
  state: EmployeeControlState;
  blocked: boolean;
};

export type EmployeePublicProfile = {
  displayName: string;
  bio?: string;
  skills?: string[];
  avatarUrl?: string;
};

export type EmployeeProjection = {
  identity: EmployeeIdentity;
  runtime: {
    runtimeStatus: EmployeeRuntimeStatus;
    effectiveAuthority?: EmployeeAuthority;
    effectiveBudget?: EmployeeBudget;
    effectiveState?: EffectiveState;
  };
  publicProfile?: EmployeePublicProfile;
  hasCognitiveProfile: boolean;
};

export type EmployeesListResponse = {
  ok: true;
  count: number;
  employees: EmployeeProjection[];
};

export type EmployeeScopeResponse = {
  ok: true;
  employeeId: string;
  companyId: string;
  teamId: string;
  status: string;
  schedulerMode: string;
  allowedTenants: string[];
  allowedServices: string[];
  allowedEnvironmentNames: string[];
  scopeBindings: unknown[];
};

export type EmployeeEffectivePolicyResponse = {
  ok: true;
  employeeId: string;
  companyId: string;
  teamId: string;
  status: string;
  implemented: boolean;
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  message?: string;
  baseAuthority?: EmployeeAuthority;
  baseBudget?: EmployeeBudget;
  effectiveAuthority?: EmployeeAuthority;
  effectiveBudget?: EmployeeBudget;
  controlState?: EffectiveState;
};

export type EmployeeControl = {
  state: EmployeeControlState;
  transition?:
    | "disabled"
    | "re_enabled"
    | "restricted"
    | "restrictions_cleared";
  budgetOverride?: EmployeeBudget;
  authorityOverride?: EmployeeAuthority;
};

export type EmployeeControlsListEntry = {
  employeeId: string;
  control: EmployeeControl | null;
  effectiveState: EffectiveState;
};

export type EmployeeControlsListResponse = {
  ok: true;
  count: number;
  entries: EmployeeControlsListEntry[];
};

export type EmployeeControlDetailResponse = {
  ok: true;
  employeeId: string;
  control: EmployeeControl | null;
  effectiveState?: EffectiveState;
};

export type EmployeeControlsResponse =
  | EmployeeControlsListResponse
  | EmployeeControlDetailResponse;

export type SchedulerStatusResponse = {
  primaryScheduler: "paperclip";
  cronFallbackEnabled: boolean;
};