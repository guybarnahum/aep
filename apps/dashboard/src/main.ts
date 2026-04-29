function getDashboardBuildCommit(): string {
  const configured = import.meta.env.VITE_BUILD_COMMIT;
  return (configured && configured.trim()) || "dev";
}

function getDashboardBuildDate(): string {
  const configured = import.meta.env.VITE_BUILD_DATE;
  return (configured && configured.trim()) || "local build";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeDashboardBuildDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "local build") {
    return null;
  }

  const utcMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s+UTC$/,
  );
  const normalized = utcMatch
    ? `${utcMatch[1]}T${utcMatch[2]}Z`
    : trimmed;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDashboardBuildDate(value: string): string {
  const parsed = normalizeDashboardBuildDate(value);
  if (!parsed) {
    return escapeHtml(value);
  }

  return escapeHtml(
    parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }),
  );
}

function renderHeaderEndpointLink(label: string, url: string): string {
  const escapedLabel = escapeHtml(label);
  const escapedUrl = escapeHtml(url);

  return `<a href="${escapedUrl}" target="_blank" rel="noreferrer">${escapedLabel} &#8599;</a>`;
}
import {
  acknowledgeEscalation,
  acknowledgeEscalationFromThread,
  approveApproval,
  approveFromThread,
  createProductDeploymentRecord,
  createIntakeRequest,
  convertIntakeToProject,
  createProjectTaskGraph,
  createProductInitiative,
  createProductIntervention,
  createEmployee,
  createEmployeeReview,
  createCanonicalThreadMessage,
  createReviewCycle,
  createStaffingRequest,
  delegateTaskFromThread,
  fulfillStaffingRequest,
  getApiBaseUrl,
  getEmployeeContinuityOverview,
  getEmployeeControlOverview,
  getEmployeeEffectivePolicy,
  getEmployeeEmploymentEvents,
  getEmployeeReviews,
  getCompanyWorkIntakeOverview,
  getProductInitiatives,
  getProductVisibility,
  getExternalMirrorOverview,
  getMessageThreadDetail,
  getMessageThreads,
  getNarrativeTimeline,
  getDepartmentOverview,
  getDefaultRuntimeEmployeeIds,
  getOrgPresenceOverview,
  getReviewCycles,
  getRoles,
  getRuntimeRolePolicies,
  getTaskDetail,
  getValidationOverview,
  getWorkTasks,
  getOperatorAgentBaseUrl,
  getServiceOverview,
  getTenantOverview,
  getTenants,
  pauseValidationScheduler,
  rejectApproval,
  rejectFromThread,
  resumeValidationScheduler,
  resolveEscalation,
  resolveEscalationFromThread,
  runAllTeams,
  runTeamOnce,
  updateSchedulerCadence,
  updateStaffingRequestStatus,
  runValidationNow,
  runEmployeeLifecycleAction,
  updateIntakeStatus,
  updateEmployeeProfile,
  updateRuntimeRolePolicy,
  executeProductDeployment,
  executeProductLifecycleAction,
  ingestProductSignal,
  requestProductLifecycleAction,
} from "./api";
import type {
  CompanyWorkIntakeOverview,
  DepartmentFilters,
  DepartmentPaginationState,
  EmployeePublicLink,
  OrgPresenceOverview,
  PageSize,
  ProductLifecycleAction,
  TeamLoopResult,
  TenantSummary,
  ValidationRunMode,
  WorkOverview,
} from "./types";
import {
  renderCompanyOverview,
  renderDepartmentOverview,
  renderEmployeeDetail,
  renderEmployeesDirectory,
  renderExternalMirrorOverview,
  renderIntakeProjectsOverview,
  renderProductInitiativeDetail,
  renderProductInitiativesOverview,
  renderNarrativeTimeline,
  renderPrimaryNav,
  renderRoleDetail,
  renderRolesCatalog,
  renderRuntimeRolePoliciesPage,
  renderServiceOverview,
  renderTaskDetail,
  renderTeamDetail,
  renderTeamsOverview,
  renderThreadDetail,
  renderTenantOverview,
  renderToolbar,
  renderValidationOverview,
  renderWorkOverview,
} from "./render";
import "./styles.css";

const app: HTMLDivElement = (() => {
  const node = document.querySelector<HTMLDivElement>("#app");
  if (!node) {
    throw new Error("App root not found");
  }
  return node;
})();

const AUTO_REFRESH_MS = 15_000;
const HOME_TENANT_STORAGE_KEY = "dashboard.home-tenant-id";
const VALIDATION_REQUESTED_BY = "dashboard_validation_operator";
const INTERNAL_TENANT_ID_CANDIDATES = [
  "internal",
  "company_internal_aep",
  "tenant_internal_aep",
] as const;
let autoRefreshTimer: number | null = null;
let mutationStatusMessage: string | null = null;
let lastRenderCompletedAt: number | null = null;
let lastAutoRefreshAt: number | null = null;
let activeRenderCount = 0;
let latestTeamLoopResults: TeamLoopResult[] = [];

type Route =
  | { kind: "tenant"; tenantId: string }
  | { kind: "service"; tenantId: string; serviceId: string }
  | { kind: "work" }
  | { kind: "intakeProjects" }
  | { kind: "productInitiatives" }
  | { kind: "productInitiative"; projectId: string }
  | { kind: "task"; taskId: string }
  | { kind: "thread"; threadId: string }
  | { kind: "employees" }
  | { kind: "employee"; employeeId: string }
  | { kind: "roles" }
  | { kind: "role"; roleId: string }
  | { kind: "runtimeRolePolicies"; roleId?: string }
  | { kind: "teams" }
  | { kind: "team"; teamId: string }
  | { kind: "company" }
  | { kind: "mirrors" }
  | { kind: "activity" }
  | { kind: "validation" }
  | { kind: "department" };

const DEFAULT_DEPARTMENT_FILTERS: DepartmentFilters = {
  selectedEmployeeId: null,
  escalationState: "all",
  decisionSeverity: "all",
  runtimeStatus: "all",
  approvalStatus: "all",
  approvalAction: "all",
};

const DEFAULT_DEPARTMENT_PAGINATION: DepartmentPaginationState = {
  employees: { page: 1, pageSize: 10 },
  escalations: { page: 1, pageSize: 10 },
  managerLog: { page: 1, pageSize: 10 },
  controlHistory: { page: 1, pageSize: 10 },
  approvals: { page: 1, pageSize: 10 },
};

function upsertTeamLoopResult(result: TeamLoopResult): void {
  const existingIndex = latestTeamLoopResults.findIndex(
    (entry) => entry.teamId === result.teamId,
  );

  if (existingIndex >= 0) {
    latestTeamLoopResults = latestTeamLoopResults.map((entry, index) =>
      index === existingIndex ? result : entry,
    );
    return;
  }

  latestTeamLoopResults = [...latestTeamLoopResults, result];
}

function getTeamLoopResult(teamId: string): TeamLoopResult | undefined {
  return latestTeamLoopResults.find((entry) => entry.teamId === teamId);
}

function getAutoRefreshEnabled(): boolean {
  return window.localStorage.getItem("dashboard.auto-refresh") === "true";
}

function setAutoRefreshEnabled(value: boolean): void {
  window.localStorage.setItem("dashboard.auto-refresh", String(value));
}

function getDepartmentFilters(): DepartmentFilters {
  const raw = window.localStorage.getItem("dashboard.department-filters");
  if (!raw) {
    return { ...DEFAULT_DEPARTMENT_FILTERS };
  }

  try {
    return {
      ...DEFAULT_DEPARTMENT_FILTERS,
      ...(JSON.parse(raw) as Partial<DepartmentFilters>),
    };
  } catch {
    return { ...DEFAULT_DEPARTMENT_FILTERS };
  }
}

function setDepartmentFilters(next: DepartmentFilters): void {
  window.localStorage.setItem("dashboard.department-filters", JSON.stringify(next));
}

function updateDepartmentFilters(
  patch: Partial<DepartmentFilters>,
): DepartmentFilters {
  const next = {
    ...getDepartmentFilters(),
    ...patch,
  };
  setDepartmentFilters(next);
  return next;
}

function resetDepartmentFilters(): DepartmentFilters {
  setDepartmentFilters({ ...DEFAULT_DEPARTMENT_FILTERS });
  return { ...DEFAULT_DEPARTMENT_FILTERS };
}

function getDepartmentPagination(): DepartmentPaginationState {
  const raw = window.localStorage.getItem("dashboard.department-pagination");
  if (!raw) {
    return structuredClone(DEFAULT_DEPARTMENT_PAGINATION);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DepartmentPaginationState>;
    return {
      employees: {
        ...DEFAULT_DEPARTMENT_PAGINATION.employees,
        ...(parsed.employees ?? {}),
      },
      escalations: {
        ...DEFAULT_DEPARTMENT_PAGINATION.escalations,
        ...(parsed.escalations ?? {}),
      },
      managerLog: {
        ...DEFAULT_DEPARTMENT_PAGINATION.managerLog,
        ...(parsed.managerLog ?? {}),
      },
      controlHistory: {
        ...DEFAULT_DEPARTMENT_PAGINATION.controlHistory,
        ...(parsed.controlHistory ?? {}),
      },
      approvals: {
        ...DEFAULT_DEPARTMENT_PAGINATION.approvals,
        ...(parsed.approvals ?? {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_DEPARTMENT_PAGINATION);
  }
}

function setDepartmentPagination(next: DepartmentPaginationState): void {
  window.localStorage.setItem("dashboard.department-pagination", JSON.stringify(next));
}

function updateDepartmentPagination(
  section: keyof DepartmentPaginationState,
  patch: Partial<DepartmentPaginationState[keyof DepartmentPaginationState]>,
): DepartmentPaginationState {
  const current = getDepartmentPagination();
  const next: DepartmentPaginationState = {
    ...current,
    [section]: {
      ...current[section],
      ...patch,
    },
  };
  setDepartmentPagination(next);
  return next;
}

function resetDepartmentPaginationPages(): DepartmentPaginationState {
  const current = getDepartmentPagination();
  const next: DepartmentPaginationState = {
    employees: { ...current.employees, page: 1 },
    escalations: { ...current.escalations, page: 1 },
    managerLog: { ...current.managerLog, page: 1 },
    controlHistory: { ...current.controlHistory, page: 1 },
    approvals: { ...current.approvals, page: 1 },
  };
  setDepartmentPagination(next);
  return next;
}

function setMutationStatus(message: string | null): void {
  mutationStatusMessage = message;
}

function setRefreshingIndicator(isRefreshing: boolean): void {
  const indicator = document.querySelector<HTMLElement>("[data-refresh-indicator]");
  if (!indicator) {
    return;
  }

  indicator.classList.toggle("refresh-indicator-hidden", !isRefreshing);
}

function isLiveOperationalRoute(route: Route): boolean {
  return (
    route.kind === "work" ||
    route.kind === "intakeProjects" ||
    route.kind === "productInitiatives" ||
    route.kind === "productInitiative" ||
    route.kind === "task" ||
    route.kind === "thread" ||
    route.kind === "employee" ||
    route.kind === "validation" ||
    route.kind === "activity" ||
    route.kind === "department"
  );
}

function getLiveSurfaceLabel(route: Route): string | null {
  switch (route.kind) {
    case "work":
      return "Canonical work";
    case "intakeProjects":
      return "Intake & Projects";
    case "productInitiatives":
      return "Product initiatives";
    case "productInitiative":
      return "Product initiative detail";
    case "task":
      return "Task detail";
    case "thread":
      return "Thread detail";
    case "employee":
      return "Employee detail";
    case "validation":
      return "Validation control loop";
    case "activity":
      return "Company activity";
    case "department":
      return "Governance";
    default:
      return null;
  }
}

function formatRefreshAge(timestampMs: number | null): string {
  if (!timestampMs) {
    return "Not refreshed yet";
  }

  const diffMs = Date.now() - timestampMs;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 5) {
    return "just now";
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}

function getStoredHomeTenantId(): string | null {
  const value = window.localStorage.getItem(HOME_TENANT_STORAGE_KEY);
  return value && value.trim() ? value.trim() : null;
}

function setStoredHomeTenantId(tenantId: string): void {
  window.localStorage.setItem(HOME_TENANT_STORAGE_KEY, tenantId);
}

function resolveHomeTenantId(tenants: TenantSummary[]): string | null {
  if (tenants.length === 0) {
    return null;
  }

  const tenantIds = new Set(tenants.map((tenant) => tenant.tenant_id));

  const storedTenantId = getStoredHomeTenantId();
  if (storedTenantId && tenantIds.has(storedTenantId)) {
    return storedTenantId;
  }

  const firstInternalTenant = tenants.find((tenant) => tenant.is_internal);
  if (firstInternalTenant) {
    setStoredHomeTenantId(firstInternalTenant.tenant_id);
    return firstInternalTenant.tenant_id;
  }

  for (const candidate of INTERNAL_TENANT_ID_CANDIDATES) {
    if (tenantIds.has(candidate)) {
      setStoredHomeTenantId(candidate);
      return candidate;
    }
  }

  const seededInternalishTenant = tenants.find(
    (tenant) =>
      tenant.source === "seeded" &&
      /(internal|aep)/i.test(`${tenant.tenant_id} ${tenant.name}`),
  );
  if (seededInternalishTenant) {
    setStoredHomeTenantId(seededInternalishTenant.tenant_id);
    return seededInternalishTenant.tenant_id;
  }

  const firstTenantId = tenants[0]?.tenant_id ?? null;
  if (firstTenantId) {
    setStoredHomeTenantId(firstTenantId);
  }
  return firstTenantId;
}

function getRoute(defaultTenantId: string): Route {
  const hash = window.location.hash.replace(/^#/, "");

  if (!hash) {
    return { kind: "tenant", tenantId: defaultTenantId };
  }

  if (hash === "department") {
    return { kind: "department" };
  }

  if (hash === "work") {
    return { kind: "work" };
  }

  if (hash === "intake-projects") {
    return { kind: "intakeProjects" };
  }

  if (hash === "product-initiatives") {
    return { kind: "productInitiatives" };
  }

  if (hash === "employees") {
    return { kind: "employees" };
  }

  if (hash === "roles") {
    return { kind: "roles" };
  }

  if (hash === "runtime-role-policies") {
    return { kind: "runtimeRolePolicies" };
  }

  if (hash === "teams") {
    return { kind: "teams" };
  }

  if (hash === "company") {
    return { kind: "company" };
  }

  if (hash === "mirrors") {
    return { kind: "mirrors" };
  }

  if (hash === "activity") {
    return { kind: "activity" };
  }

  if (hash === "validation") {
    return { kind: "validation" };
  }

  const runtimeRolePolicyMatch = hash.match(/^runtime-role-policies\/(.+)$/);
  if (runtimeRolePolicyMatch?.[1]) {
    return {
      kind: "runtimeRolePolicies",
      roleId: decodeURIComponent(runtimeRolePolicyMatch[1]),
    };
  }

  const taskMatch = hash.match(/^task\/(.+)$/);
  if (taskMatch?.[1]) {
    return {
      kind: "task",
      taskId: decodeURIComponent(taskMatch[1]),
    };
  }

  const threadMatch = hash.match(/^thread\/(.+)$/);
  if (threadMatch?.[1]) {
    return { kind: "thread", threadId: decodeURIComponent(threadMatch[1]) };
  }

  const employeeMatch = hash.match(/^employee\/(.+)$/);
  if (employeeMatch?.[1]) {
    return {
      kind: "employee",
      employeeId: decodeURIComponent(employeeMatch[1]),
    };
  }

  const roleMatch = hash.match(/^role\/(.+)$/);
  if (roleMatch?.[1]) {
    return {
      kind: "role",
      roleId: decodeURIComponent(roleMatch[1]),
    };
  }

  const productInitiativeMatch = hash.match(/^product-initiative\/(.+)$/);
  if (productInitiativeMatch?.[1]) {
    return {
      kind: "productInitiative",
      projectId: decodeURIComponent(productInitiativeMatch[1]),
    };
  }

  const teamMatch = hash.match(/^team\/(.+)$/);
  if (teamMatch?.[1]) {
    return {
      kind: "team",
      teamId: decodeURIComponent(teamMatch[1]),
    };
  }

  const parts = hash.split("/");

  if (parts[0] === "tenant" && parts[1] && parts[2] === "service" && parts[3]) {
    return {
      kind: "service",
      tenantId: decodeURIComponent(parts[1]),
      serviceId: decodeURIComponent(parts[3]),
    };
  }

  if (parts[0] === "tenant" && parts[1]) {
    return {
      kind: "tenant",
      tenantId: decodeURIComponent(parts[1]),
    };
  }

  return { kind: "tenant", tenantId: defaultTenantId };
}

function renderShell(content: string, error?: string): void {
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>AEP Dashboard</h1>
          <p class="muted">Agentic company view: work, employees, teams, and governance.</p>
        </div>
        <div class="endpoint-stack muted">
          <div>${renderHeaderEndpointLink("Control Plane", getApiBaseUrl())}</div>
          <div>${renderHeaderEndpointLink("Operator Agent", getOperatorAgentBaseUrl())}</div>
          <div class="build-meta">
            <div>Dashboard build: ${escapeHtml(getDashboardBuildCommit())}</div>
            <div>${formatDashboardBuildDate(getDashboardBuildDate())}</div>
          </div>
        </div>
      </header>

      ${error ? `<div class="error-banner">${error}</div>` : ""}

      ${content}
    </div>
  `;
}

function attachToolbarHandlers(): void {
  const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
  const autoRefreshToggle =
    document.querySelector<HTMLInputElement>("#auto-refresh-toggle");

  refreshButton?.addEventListener("click", () => {
    void renderRoute();
  });

  autoRefreshToggle?.addEventListener("change", () => {
    setAutoRefreshEnabled(autoRefreshToggle.checked);
    syncAutoRefresh();
  });
}

function attachDepartmentFilterHandlers(): void {
  const employeeFilter =
    document.querySelector<HTMLSelectElement>("#employee-filter");
  const escalationStateFilter =
    document.querySelector<HTMLSelectElement>("#escalation-state-filter");
  const decisionSeverityFilter =
    document.querySelector<HTMLSelectElement>("#decision-severity-filter");
  const employeeRuntimeStatusFilter =
    document.querySelector<HTMLSelectElement>("#employee-runtime-status-filter");
  const approvalStatusFilter =
    document.querySelector<HTMLSelectElement>("#approval-status-filter");
  const approvalActionFilter =
    document.querySelector<HTMLSelectElement>("#approval-action-filter");
  const clearFiltersButton =
    document.querySelector<HTMLButtonElement>("#clear-filters-button");

  employeeFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      selectedEmployeeId: employeeFilter.value || null,
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  escalationStateFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      escalationState: escalationStateFilter.value as DepartmentFilters["escalationState"],
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  decisionSeverityFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      decisionSeverity: decisionSeverityFilter.value as DepartmentFilters["decisionSeverity"],
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  employeeRuntimeStatusFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      runtimeStatus: employeeRuntimeStatusFilter.value as DepartmentFilters["runtimeStatus"],
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  approvalStatusFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      approvalStatus: approvalStatusFilter.value as DepartmentFilters["approvalStatus"],
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  approvalActionFilter?.addEventListener("change", () => {
    updateDepartmentFilters({
      approvalAction: approvalActionFilter.value as DepartmentFilters["approvalAction"],
    });
    resetDepartmentPaginationPages();
    void renderRoute();
  });

  clearFiltersButton?.addEventListener("click", () => {
    resetDepartmentFilters();
    resetDepartmentPaginationPages();
    void renderRoute();
  });
}

function attachDepartmentActionHandlers(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action='select-employee']").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.employeeId;
      if (!employeeId) return;
      updateDepartmentFilters({ selectedEmployeeId: employeeId });
      resetDepartmentPaginationPages();
      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='acknowledge-escalation']").forEach((button) => {
    button.addEventListener("click", async () => {
      const escalationId = button.dataset.escalationId;
      if (!escalationId) return;

      try {
        setMutationStatus(`Acknowledging ${escalationId}…`);
        void renderRoute();
        await acknowledgeEscalation(escalationId);
        setMutationStatus(`Acknowledged ${escalationId}`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to acknowledge escalation",
        );
      }
      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='resolve-escalation']").forEach((button) => {
    button.addEventListener("click", async () => {
      const escalationId = button.dataset.escalationId;
      if (!escalationId) return;

      const note = window.prompt(
        `Resolution note for ${escalationId}:`,
        "Resolved from dashboard operator review.",
      );

      if (note === null) {
        return;
      }

      try {
        setMutationStatus(`Resolving ${escalationId}…`);
        void renderRoute();
        await resolveEscalation(escalationId, note);
        setMutationStatus(`Resolved ${escalationId}`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to resolve escalation",
        );
      }
      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='approve-approval']").forEach((button) => {
    button.addEventListener("click", async () => {
      const approvalId = button.dataset.approvalId;
      if (!approvalId) return;

      try {
        setMutationStatus(`Approving ${approvalId}...`);
        void renderRoute();
        await approveApproval(approvalId);
        setMutationStatus(`Approved ${approvalId}`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to approve approval",
        );
      }
      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='reject-approval']").forEach((button) => {
    button.addEventListener("click", async () => {
      const approvalId = button.dataset.approvalId;
      if (!approvalId) return;

      const note = window.prompt(
        `Rejection note for ${approvalId}:`,
        "Rejected from dashboard operator review.",
      );

      if (note === null) {
        return;
      }

      try {
        setMutationStatus(`Rejecting ${approvalId}...`);
        void renderRoute();
        await rejectApproval(approvalId, "dashboard-operator", note);
        setMutationStatus(`Rejected ${approvalId}`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to reject approval",
        );
      }
      void renderRoute();
    });
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='create-staffing-request-from-gap']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleCreateStaffingRequestFromGap(button);
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='submit-staffing-request']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleStaffingRequestStatus(button, "submitted");
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='approve-staffing-request']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleStaffingRequestStatus(button, "approved");
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='reject-staffing-request']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleStaffingRequestStatus(button, "rejected");
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='cancel-staffing-request']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleStaffingRequestStatus(button, "canceled");
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='fulfill-staffing-request']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await handleFulfillStaffingRequest(button);
      });
    });

  document.querySelectorAll<HTMLButtonElement>("[data-action='page-prev']").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section as keyof DepartmentPaginationState | undefined;
      if (!section) return;

      const current = getDepartmentPagination();
      updateDepartmentPagination(section, {
        page: Math.max(1, current[section].page - 1),
      });
      void updateDepartmentPaginationView();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='page-next']").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section as keyof DepartmentPaginationState | undefined;
      if (!section) return;

      const current = getDepartmentPagination();
      updateDepartmentPagination(section, {
        page: current[section].page + 1,
      });
      void updateDepartmentPaginationView();
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-action='page-size']").forEach((select) => {
    select.addEventListener("change", () => {
      const section = select.dataset.section as keyof DepartmentPaginationState | undefined;
      if (!section) return;

      const nextSize = Number(select.value) as PageSize;
      if (![10, 20, 50].includes(nextSize)) return;

      updateDepartmentPagination(section, {
        page: 1,
        pageSize: nextSize,
      });
      void updateDepartmentPaginationView();
    });
  });
}

async function handleCreateStaffingRequestFromGap(target: HTMLElement): Promise<void> {
  const roleId = target.dataset.roleId ?? "";
  const teamId = target.dataset.teamId ?? "";
  const reason = target.dataset.reason ?? "role gap";
  const requestedByEmployeeId = window.prompt("Requested by employee ID?")?.trim() ?? "";
  if (!roleId || !teamId || !requestedByEmployeeId) return;

  try {
    setMutationStatus(`Creating staffing request for ${roleId}...`);
    void renderRoute();
    await createStaffingRequest({
      roleId,
      teamId,
      reason: `Staffing gap: ${reason}`,
      urgency: "normal",
      requestedByEmployeeId,
      source: { kind: "role", roleId },
      status: "submitted",
    });
    setMutationStatus(`Created staffing request for ${roleId}`);
  } catch (error) {
    setMutationStatus(
      error instanceof Error ? error.message : "Failed to create staffing request",
    );
  }
  void renderRoute();
}

async function handleStaffingRequestStatus(
  target: HTMLElement,
  status: "submitted" | "approved" | "rejected" | "canceled",
): Promise<void> {
  const staffingRequestId = target.dataset.staffingRequestId ?? "";
  if (!staffingRequestId) return;

  const approvedByEmployeeId =
    status === "approved"
      ? window.prompt("Approved by employee ID?")?.trim() ?? ""
      : undefined;
  if (status === "approved" && !approvedByEmployeeId) return;

  const reason =
    status === "rejected" || status === "canceled"
      ? window.prompt("Reason?")?.trim() ?? undefined
      : undefined;

  try {
    setMutationStatus(`Updating staffing request ${staffingRequestId} to ${status}...`);
    void renderRoute();
    await updateStaffingRequestStatus(staffingRequestId, {
      status,
      approvedByEmployeeId,
      reason,
    });
    setMutationStatus(`Updated staffing request ${staffingRequestId} to ${status}`);
  } catch (error) {
    setMutationStatus(
      error instanceof Error ? error.message : "Failed to update staffing request",
    );
  }
  void renderRoute();
}

async function handleFulfillStaffingRequest(target: HTMLElement): Promise<void> {
  const staffingRequestId = target.dataset.staffingRequestId ?? "";
  if (!staffingRequestId) return;

  const employeeName = window.prompt("New employee display name?")?.trim() ?? "";
  const fulfilledByEmployeeId = window.prompt("Fulfilled by employee ID?")?.trim() ?? "";
  if (!employeeName || !fulfilledByEmployeeId) return;

  try {
    setMutationStatus(`Fulfilling staffing request ${staffingRequestId}...`);
    void renderRoute();
    await fulfillStaffingRequest(staffingRequestId, {
      employeeName,
      fulfilledByEmployeeId,
      runtimeStatus: "planned",
      employmentStatus: "draft",
      schedulerMode: "manual_only",
    });
    setMutationStatus(`Fulfilled staffing request ${staffingRequestId}`);
  } catch (error) {
    setMutationStatus(
      error instanceof Error ? error.message : "Failed to fulfill staffing request",
    );
  }
  void renderRoute();
}

async function resolveDashboardRuntimeEmployees(): Promise<{
  infraOpsManagerEmployeeId: string;
  timeoutRecoveryEmployeeId: string;
}> {
  return getDefaultRuntimeEmployeeIds();
}

function attachValidationHandlers(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action='run-validation-now']").forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = (button.dataset.mode as ValidationRunMode | undefined) ?? "full";

      try {
        setMutationStatus(`Starting ${mode} validation run…`);
        void renderRoute();
        const result = await runValidationNow({
          requestedBy: VALIDATION_REQUESTED_BY,
          mode,
          reason: "governance_review",
        });
        setMutationStatus(
          `Validation batch ${result.dispatch_batch_id} started: ${result.executed} executed.`,
        );
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to start validation run",
        );
      }

      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='pause-validation-scheduler']").forEach((button) => {
    button.addEventListener("click", async () => {
      const reason = window.prompt(
        "Pause reason:",
        "Paused from dashboard while investigating validation failures.",
      );

      if (reason === null) {
        return;
      }

      try {
        setMutationStatus("Pausing recurring validation…");
        void renderRoute();
        await pauseValidationScheduler({
          requestedBy: VALIDATION_REQUESTED_BY,
          reason,
        });
        setMutationStatus("Recurring validation paused.");
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to pause recurring validation",
        );
      }

      void renderRoute();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-action='resume-validation-scheduler']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        setMutationStatus("Resuming recurring validation…");
        void renderRoute();
        await resumeValidationScheduler(VALIDATION_REQUESTED_BY);
        setMutationStatus("Recurring validation resumed.");
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to resume recurring validation",
        );
      }

      void renderRoute();
    });
  });
}

function attachTeamLoopHandlers(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action='run-all-teams']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        setMutationStatus("Running all team loops…");
        void renderRoute();
        const response = await runAllTeams(getOperatorAgentBaseUrl());
        latestTeamLoopResults = response.results ?? [];
        setMutationStatus(`Ran ${latestTeamLoopResults.length} team loops.`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : "Failed to run all team loops",
        );
      }

      void renderRoute();
    });
  });

  document
    .querySelectorAll<HTMLFormElement>("form[data-action='update-team-loop-cadence']")
    .forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const teamTickIntervalMinutes = Number(
          formData.get("teamTickIntervalMinutes") ?? "",
        );
        const managerTickIntervalMinutes = Number(
          formData.get("managerTickIntervalMinutes") ?? "",
        );
        const updatedBy = String(formData.get("updatedBy") ?? "").trim();
        const expectedUpdatedAt = String(
          formData.get("expectedUpdatedAt") ?? "",
        ).trim();

        try {
          setMutationStatus("Saving team loop cadence…");
          void renderRoute();
          await updateSchedulerCadence({
            teamTickIntervalMinutes,
            managerTickIntervalMinutes,
            updatedBy,
            expectedUpdatedAt: expectedUpdatedAt || null,
          });
          setMutationStatus(
            `Saved team cadence ${teamTickIntervalMinutes}m and manager cadence ${managerTickIntervalMinutes}m.`,
          );
        } catch (error) {
          setMutationStatus(
            error instanceof Error ? error.message : "Failed to update scheduler cadence",
          );
        }

        void renderRoute();
      });
    });

  document.querySelectorAll<HTMLButtonElement>("[data-action='run-team-once']").forEach((button) => {
    button.addEventListener("click", async () => {
      const teamId = button.dataset.teamId;
      if (!teamId) {
        setMutationStatus("Missing teamId for team loop action.");
        void renderRoute();
        return;
      }

      try {
        setMutationStatus(`Running ${teamId} once…`);
        void renderRoute();
        const result = await runTeamOnce(getOperatorAgentBaseUrl(), teamId);
        upsertTeamLoopResult(result);
        setMutationStatus(`Ran team loop for ${teamId}: ${result.status}.`);
      } catch (error) {
        setMutationStatus(
          error instanceof Error ? error.message : `Failed to run team loop for ${teamId}`,
        );
      }

      void renderRoute();
    });
  });
}

function parseTaskGraphJson(raw: string): Array<{
  clientTaskId: string;
  title: string;
  taskType: string;
  assignedTeamId: string;
  dependsOnClientTaskIds?: string[];
}> {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Task graph JSON must be an array");
  }
  return parsed;
}

function attachIntakeProjectHandlers(): void {
  document
    .querySelectorAll<HTMLFormElement>("form[data-action='create-intake']")
    .forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);

        try {
          setMutationStatus("Creating intake request...");
          void renderRoute();
          const intake = await createIntakeRequest({
            companyId: String(formData.get("companyId") ?? "").trim(),
            title: String(formData.get("title") ?? "").trim(),
            description: String(formData.get("description") ?? "").trim(),
            requestedBy: String(formData.get("requestedBy") ?? "").trim(),
            source: String(formData.get("source") ?? "dashboard").trim(),
          });
          setMutationStatus(`Created intake ${intake.id}.`);
        } catch (error) {
          setMutationStatus(error instanceof Error ? error.message : "Failed to create intake");
        }

        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='triage-intake']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const intakeId = button.dataset.intakeId;
        if (!intakeId) return;

        try {
          setMutationStatus(`Marking ${intakeId} triaged...`);
          void renderRoute();
          await updateIntakeStatus(intakeId, "triaged");
          setMutationStatus(`Marked ${intakeId} triaged.`);
        } catch (error) {
          setMutationStatus(error instanceof Error ? error.message : "Failed to triage intake");
        }

        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='reject-intake']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const intakeId = button.dataset.intakeId;
        if (!intakeId) return;

        try {
          setMutationStatus(`Rejecting ${intakeId}...`);
          void renderRoute();
          await updateIntakeStatus(intakeId, "rejected");
          setMutationStatus(`Rejected ${intakeId}.`);
        } catch (error) {
          setMutationStatus(error instanceof Error ? error.message : "Failed to reject intake");
        }

        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLFormElement>("form[data-action='convert-intake']")
    .forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const intakeId = String(formData.get("intakeId") ?? "").trim();

        try {
          setMutationStatus(`Converting ${intakeId} to project...`);
          void renderRoute();
          const result = await convertIntakeToProject({
            intakeId,
            convertedByEmployeeId: String(formData.get("convertedByEmployeeId") ?? "").trim(),
            ownerTeamId: String(formData.get("ownerTeamId") ?? "").trim(),
            projectTitle: String(formData.get("projectTitle") ?? "").trim(),
            projectDescription: String(formData.get("projectDescription") ?? "").trim(),
            rationale: String(formData.get("rationale") ?? "").trim(),
          });
          setMutationStatus(`Created project ${result.project.id} from intake ${intakeId}.`);
        } catch (error) {
          setMutationStatus(error instanceof Error ? error.message : "Failed to convert intake");
        }

        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLFormElement>("form[data-action='create-project-task-graph']")
    .forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const projectId = String(formData.get("projectId") ?? "").trim();

        try {
          setMutationStatus(`Creating task graph for ${projectId}...`);
          void renderRoute();
          const result = await createProjectTaskGraph({
            projectId,
            createdByEmployeeId: String(formData.get("createdByEmployeeId") ?? "").trim(),
            rationale: String(formData.get("rationale") ?? "").trim(),
            tasks: parseTaskGraphJson(String(formData.get("tasksJson") ?? "[]")),
          });
          setMutationStatus(`Created ${result.taskCount} tasks for project ${projectId}.`);
        } catch (error) {
          setMutationStatus(error instanceof Error ? error.message : "Failed to create task graph");
        }

        void renderRoute();
      });
    });
}

function attachProductInitiativeHandlers(): void {
  const form = document.querySelector<HTMLFormElement>("#create-product-initiative-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    try {
      setMutationStatus("Creating product initiative...");
      void renderRoute();

      const initiativeKindRaw = String(formData.get("initiativeKind") ?? "marketing_site");
      const productSurfaceRaw = String(formData.get("productSurface") ?? "website_bundle");
      const externalVisibilityRaw = String(formData.get("externalVisibility") ?? "internal_only");

      const project = await createProductInitiative({
        companyId: "company_internal_aep",
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        createdByEmployeeId:
          String(formData.get("createdByEmployeeId") ?? "").trim() || undefined,
        initiativeKind:
          initiativeKindRaw === "customer_intake_surface" ||
          initiativeKindRaw === "tenant_conversion_surface"
            ? initiativeKindRaw
            : "marketing_site",
        productSurface:
          productSurfaceRaw === "customer_intake" ||
          productSurfaceRaw === "public_progress"
            ? productSurfaceRaw
            : "website_bundle",
        externalVisibility:
          externalVisibilityRaw === "external_safe"
            ? "external_safe"
            : "internal_only",
      });

      setMutationStatus(`Created initiative ${project.id}`);
      window.location.hash = `product-initiative/${encodeURIComponent(project.id)}`;
    } catch (error) {
      setMutationStatus(
        error instanceof Error ? error.message : "Failed to create initiative",
      );
      void renderRoute();
    }
  });
}

function attachProductInterventionHandlers(): void {
  const form = document.querySelector<HTMLFormElement>("#product-intervention-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const projectId = form.dataset.projectId;
    if (!projectId) {
      return;
    }

    const formData = new FormData(form);

    try {
      setMutationStatus("Creating intervention request...");
      void renderRoute();

      const actionRaw = String(formData.get("action") ?? "add_direction");
      const action =
        actionRaw === "request_redesign" ||
        actionRaw === "change_priority" ||
        actionRaw === "review_validation" ||
        actionRaw === "review_deployment_risk" ||
        actionRaw === "pause_for_human_review"
          ? actionRaw
          : "add_direction";

      await createProductIntervention({
        projectId,
        action,
        createdByEmployeeId: String(formData.get("createdByEmployeeId") ?? "").trim(),
        note: String(formData.get("note") ?? "").trim(),
        targetTaskId: String(formData.get("targetTaskId") ?? "").trim() || undefined,
        targetArtifactId:
          String(formData.get("targetArtifactId") ?? "").trim() || undefined,
        targetDeploymentId:
          String(formData.get("targetDeploymentId") ?? "").trim() || undefined,
      });

      setMutationStatus("Intervention recorded as canonical AEP coordination work");
    } catch (error) {
      setMutationStatus(
        error instanceof Error ? error.message : "Failed to create intervention",
      );
    }

    void renderRoute();
  });
}

function attachProductIntakeHandlers(): void {
  const form = document.querySelector<HTMLFormElement>("#create-product-intake-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      setMutationStatus("Creating intake…");
      const intake = await createIntakeRequest({
        companyId: "company_internal_aep",
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        requestedBy: String(formData.get("requestedBy") ?? "").trim(),
        source: "dashboard_product_operator",
      });
      setMutationStatus(`Created intake ${intake.id}. Convert it from Intake & Projects.`);
      window.location.hash = "intake-projects";
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to create intake");
    }
  });
}

function attachProductOperatorControlHandlers(): void {
  document.querySelectorAll<HTMLFormElement>("[data-form='create-deployment-record']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await runManualAction(async () => {
        const result = await createProductDeploymentRecord({
          sourceArtifactId: String(formData.get("sourceArtifactId") ?? "").trim(),
          requestedByEmployeeId: String(formData.get("requestedByEmployeeId") ?? "").trim(),
          environment: String(formData.get("environment") ?? "").trim() || "staging",
          approvalId: String(formData.get("approvalId") ?? "").trim() || undefined,
        });
        return `Deployment record created: ${result.deployment.id}`;
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='decide-deployment-approval']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter as HTMLButtonElement | null;
      const formData = new FormData(form);
      await runManualAction(async () => {
        const approvalId = String(formData.get("approvalId") ?? "").trim();
        const decidedBy = String(formData.get("decidedBy") ?? "").trim() || "dashboard-operator";
        const decisionNote = String(formData.get("decisionNote") ?? "").trim() || undefined;
        if (submitter?.value === "reject") {
          await rejectApproval(approvalId, decidedBy, decisionNote);
          return "Deployment approval rejected";
        }
        await approveApproval(approvalId, decidedBy, decisionNote);
        return "Deployment approval approved";
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='execute-deployment']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await runManualAction(async () => {
        const result = await executeProductDeployment({
          deploymentId: String(formData.get("deploymentId") ?? "").trim(),
          executedByEmployeeId: String(formData.get("executedByEmployeeId") ?? "").trim(),
        });
        return `Deployment executed${result.provider.targetUrl ? `: ${result.provider.targetUrl}` : ""}`;
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='request-lifecycle']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await runManualAction(async () => {
        const result = await requestProductLifecycleAction({
          projectId: form.dataset.projectId ?? "",
          action: formData.get("action") as ProductLifecycleAction,
          requestedByEmployeeId: String(formData.get("requestedByEmployeeId") ?? "").trim(),
          reason: String(formData.get("reason") ?? "").trim(),
          targetState: String(formData.get("targetState") ?? "").trim() || undefined,
        });
        return `Lifecycle approval requested: ${result.approvalId}`;
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='decide-lifecycle-approval']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter as HTMLButtonElement | null;
      const formData = new FormData(form);
      await runManualAction(async () => {
        const approvalId = String(formData.get("approvalId") ?? "").trim();
        const decidedBy = String(formData.get("decidedBy") ?? "").trim() || "dashboard-operator";
        const decisionNote = String(formData.get("decisionNote") ?? "").trim() || undefined;
        if (submitter?.value === "reject") {
          await rejectApproval(approvalId, decidedBy, decisionNote);
          return "Lifecycle approval rejected";
        }
        await approveApproval(approvalId, decidedBy, decisionNote);
        return "Lifecycle approval approved";
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='execute-lifecycle']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await runManualAction(async () => {
        const result = await executeProductLifecycleAction({
          projectId: form.dataset.projectId ?? "",
          approvalId: String(formData.get("approvalId") ?? "").trim(),
          executedByEmployeeId: String(formData.get("executedByEmployeeId") ?? "").trim(),
        });
        return `Lifecycle executed: ${result.project.status}`;
      });
    });
  });

  document.querySelectorAll<HTMLFormElement>("[data-form='ingest-product-signal']").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await runManualAction(async () => {
        const result = await ingestProductSignal({
          companyId: "company_internal_aep",
          projectId: form.dataset.projectId,
          source: formData.get("source") as "validation" | "monitoring" | "customer_intake",
          severity: formData.get("severity") as "info" | "warning" | "failed" | "critical",
          title: String(formData.get("title") ?? "").trim(),
          body: String(formData.get("body") ?? "").trim(),
          receivedAt: new Date().toISOString(),
        });
        return `Signal routed to ${result.route}${result.intakeId ? ` ${result.intakeId}` : ""}`;
      });
    });
  });
}

async function runManualAction(action: () => Promise<string>): Promise<void> {
  try {
    setMutationStatus("Running operator action…");
    const message = await action();
    setMutationStatus(message);
    await renderRoute();
  } catch (error) {
    setMutationStatus(error instanceof Error ? error.message : "Operator action failed");
  }
}

function resolveThreadMessageRecipient(detail: Awaited<ReturnType<typeof getMessageThreadDetail>>): {
  receiverEmployeeId?: string;
  receiverTeamId?: string;
} | null {
  const reverseMessages = [...detail.messages].reverse();

  const canonicalSender = reverseMessages.find((message) => {
    return (
      (message.source === "internal" ||
        message.source === "dashboard" ||
        message.source === "system") &&
      typeof message.senderEmployeeId === "string" &&
      message.senderEmployeeId.trim().length > 0 &&
      !message.senderEmployeeId.startsWith("external_") &&
      message.senderEmployeeId !== "human_dashboard_operator"
    );
  });

  if (canonicalSender?.senderEmployeeId) {
    return { receiverEmployeeId: canonicalSender.senderEmployeeId };
  }

  if (detail.thread.createdByEmployeeId) {
    return { receiverEmployeeId: detail.thread.createdByEmployeeId };
  }

  return null;
}

function parseOptionalJsonObject(
  raw: string,
): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function splitCommaValues(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parsePublicLinks(raw: string): EmployeePublicLink[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [type, url, verified, visibility] = line.split("|").map((value) => value.trim());
      if (!type || !url) {
        throw new Error("Each public link must use type|url|verified|visibility format.");
      }

      return {
        type: (type || "website") as EmployeePublicLink["type"],
        url,
        verified: verified === "true",
        visibility: (visibility || "public") as EmployeePublicLink["visibility"],
      };
    });
}

function toIsoDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const candidate = trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return parsed.toISOString();
}

function parseDimensionScores(raw: string): Array<{ key: string; score: number; note?: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, scoreRaw, note] = line.split("|").map((value) => value.trim());
      const score = Number(scoreRaw);
      if (!key || Number.isNaN(score)) {
        throw new Error("Each dimension score must use key|score|optional note format.");
      }

      return {
        key,
        score,
        note: note || undefined,
      };
    });
}

function parseRecommendations(raw: string): Array<{ recommendationType: "promote" | "coach" | "reassign" | "restrict" | "no_change"; summary: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [recommendationType, summary] = line.split("|").map((value) => value.trim());
      if (!recommendationType || !summary) {
        throw new Error("Each recommendation must use type|summary format.");
      }

      return {
        recommendationType: recommendationType as "promote" | "coach" | "reassign" | "restrict" | "no_change",
        summary,
      };
    });
}

function parseEvidence(raw: string): Array<{ evidenceType: "task" | "artifact" | "thread"; evidenceId: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [evidenceType, evidenceId] = line.split("|").map((value) => value.trim());
      if (!evidenceType || !evidenceId) {
        throw new Error("Each evidence entry must use type|id format.");
      }

      return {
        evidenceType: evidenceType as "task" | "artifact" | "thread",
        evidenceId,
      };
    });
}

function attachPeopleHandlers(): void {
  const createEmployeeForm = document.querySelector<HTMLFormElement>("#people-create-employee-form");
  const createReviewCycleForm = document.querySelector<HTMLFormElement>("#people-create-review-cycle-form");

  createEmployeeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createEmployeeForm);

    try {
      setMutationStatus("Creating employee…");
      void renderRoute();
      await createEmployee({
        employeeId: String(formData.get("employeeId") ?? "").trim() || undefined,
        employeeName: String(formData.get("employeeName") ?? "").trim(),
        teamId: String(formData.get("teamId") ?? "").trim(),
        roleId: String(formData.get("roleId") ?? "").trim(),
        runtimeStatus: String(formData.get("runtimeStatus") ?? "active").trim() as "planned" | "active" | "disabled",
        employmentStatus: String(formData.get("employmentStatus") ?? "active").trim() as "draft" | "active",
        schedulerMode: String(formData.get("schedulerMode") ?? "auto").trim(),
        bio: String(formData.get("bio") ?? "").trim() || undefined,
        skills: splitCommaValues(String(formData.get("skills") ?? "")),
        approvedBy: String(formData.get("approvedBy") ?? "").trim() || undefined,
      });
      setMutationStatus("Employee created.");
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to create employee");
    }
    void renderRoute();
  });

  createReviewCycleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createReviewCycleForm);

    try {
      setMutationStatus("Creating review cycle…");
      void renderRoute();
      await createReviewCycle({
        name: String(formData.get("name") ?? "").trim(),
        periodStart: toIsoDate(String(formData.get("periodStart") ?? "")) ?? "",
        periodEnd: toIsoDate(String(formData.get("periodEnd") ?? "")) ?? "",
        status: String(formData.get("status") ?? "draft").trim() as "draft" | "active" | "closed",
        createdBy: String(formData.get("createdBy") ?? "").trim() || undefined,
      });
      setMutationStatus("Review cycle created.");
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to create review cycle");
    }
    void renderRoute();
  });
}

function parseJsonField<T>(formData: FormData, fieldName: string): T {
  const raw = String(formData.get(fieldName) ?? "").trim();
  if (!raw) {
    throw new Error(`${fieldName} JSON is required`);
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} JSON must be an object`);
  }

  return parsed as T;
}

function attachRuntimeRolePolicyHandlers(): void {
  const form = document.querySelector<HTMLFormElement>("#runtime-role-policy-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const roleId = form.dataset.roleId;
    if (!roleId) {
      return;
    }

    const formData = new FormData(form);

    try {
      setMutationStatus(`Saving runtime policy for ${roleId}...`);
      void renderRoute();

      await updateRuntimeRolePolicy(roleId, {
        authority: parseJsonField(formData, "authority"),
        budget: parseJsonField(formData, "budget"),
        escalation: parseJsonField(formData, "escalation"),
        updatedBy:
          String(formData.get("updatedBy") ?? "").trim() ||
          "human_dashboard_operator",
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });

      setMutationStatus(`Saved runtime policy for ${roleId}.`);
    } catch (error) {
      setMutationStatus(
        error instanceof Error ? error.message : "Failed to save runtime role policy",
      );
    }

    void renderRoute();
  });
}

function attachEmployeeManagementHandlers(): void {
  const profileForm = document.querySelector<HTMLFormElement>("#employee-profile-form");
  const lifecycleForm = document.querySelector<HTMLFormElement>("#employee-lifecycle-form");
  const reviewForm = document.querySelector<HTMLFormElement>("#employee-review-form");

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const employeeId = profileForm.dataset.employeeId;
    if (!employeeId) return;
    const formData = new FormData(profileForm);

    try {
      setMutationStatus(`Updating ${employeeId} profile…`);
      void renderRoute();
      await updateEmployeeProfile(employeeId, {
        employeeName: String(formData.get("employeeName") ?? "").trim() || undefined,
        schedulerMode: String(formData.get("schedulerMode") ?? "").trim() || undefined,
        bio: String(formData.get("bio") ?? "").trim() || undefined,
        skills: splitCommaValues(String(formData.get("skills") ?? "")),
        avatarUrl: String(formData.get("avatarUrl") ?? "").trim() || undefined,
        appearanceSummary: String(formData.get("appearanceSummary") ?? "").trim() || undefined,
        birthYear: String(formData.get("birthYear") ?? "").trim()
          ? Number(String(formData.get("birthYear") ?? "").trim())
          : undefined,
        publicLinks: parsePublicLinks(String(formData.get("publicLinks") ?? "")),
      });
      setMutationStatus(`Updated ${employeeId} profile.`);
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to update employee profile");
    }
    void renderRoute();
  });

  lifecycleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const employeeId = lifecycleForm.dataset.employeeId;
    if (!employeeId) return;
    const formData = new FormData(lifecycleForm);
    const action = String(formData.get("action") ?? "activate").trim() as
      | "activate"
      | "reassign-team"
      | "change-role"
      | "start-leave"
      | "end-leave"
      | "retire"
      | "terminate"
      | "rehire"
      | "archive";

    try {
      setMutationStatus(`Applying ${action} for ${employeeId}…`);
      void renderRoute();
      await runEmployeeLifecycleAction(employeeId, action, {
        toTeamId: String(formData.get("toTeamId") ?? "").trim() || undefined,
        toRoleId: String(formData.get("toRoleId") ?? "").trim() || undefined,
        reason: String(formData.get("reason") ?? "").trim() || undefined,
        approvedBy: String(formData.get("approvedBy") ?? "").trim() || undefined,
        effectiveAt: toIsoDate(String(formData.get("effectiveAt") ?? "")),
      });
      setMutationStatus(`Applied ${action} for ${employeeId}.`);
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to apply lifecycle action");
    }
    void renderRoute();
  });

  reviewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const employeeId = reviewForm.dataset.employeeId;
    if (!employeeId) return;
    const formData = new FormData(reviewForm);

    try {
      setMutationStatus(`Creating review for ${employeeId}…`);
      void renderRoute();
      await createEmployeeReview(employeeId, {
        reviewCycleId: String(formData.get("reviewCycleId") ?? "").trim(),
        summary: String(formData.get("summary") ?? "").trim(),
        strengths: splitCommaValues(String(formData.get("strengths") ?? "")),
        gaps: splitCommaValues(String(formData.get("gaps") ?? "")),
        dimensionScores: parseDimensionScores(String(formData.get("dimensionScores") ?? "")),
        recommendations: parseRecommendations(String(formData.get("recommendations") ?? "")),
        evidence: parseEvidence(String(formData.get("evidence") ?? "")),
        createdBy: String(formData.get("createdBy") ?? "").trim() || undefined,
      });
      setMutationStatus(`Created review for ${employeeId}.`);
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : "Failed to create employee review");
    }
    void renderRoute();
  });
}

function attachThreadInteractionHandlers(threadId: string): void {
  const composeForm = document.querySelector<HTMLFormElement>("#thread-compose-form");
  const subjectInput = document.querySelector<HTMLInputElement>("#thread-compose-subject");
  const bodyInput = document.querySelector<HTMLTextAreaElement>("#thread-compose-body");
  const delegateForm = document.querySelector<HTMLFormElement>("#thread-delegate-form");
  const delegateSourceMessageInput =
    document.querySelector<HTMLSelectElement>("#thread-delegate-source-message-id");
  const delegateOriginatingTeamInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-originating-team-id");
  const delegateAssignedTeamInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-assigned-team-id");
  const delegateAssignedEmployeeInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-assigned-employee-id");
  const delegateOwnerEmployeeInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-owner-employee-id");
  const delegateTaskTypeInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-task-type");
  const delegateTitleInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-title");
  const delegatePayloadInput =
    document.querySelector<HTMLTextAreaElement>("#thread-delegate-payload");
  const delegateDependsOnInput =
    document.querySelector<HTMLInputElement>("#thread-delegate-depends-on");

  composeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const body = bodyInput?.value.trim() ?? "";
    const subject = subjectInput?.value.trim() ?? "";

    if (!body) {
      setMutationStatus("Message body is required.");
      void renderRoute();
      return;
    }

    try {
      setMutationStatus(`Sending canonical message into ${threadId}…`);
      void renderRoute();

      const detail = await getMessageThreadDetail(threadId);
      const recipient = resolveThreadMessageRecipient(detail);

      if (!recipient) {
        throw new Error("Could not resolve a canonical recipient for this thread.");
      }

      await createCanonicalThreadMessage({
        threadId,
        body,
        subject: subject || undefined,
        receiverEmployeeId: recipient.receiverEmployeeId,
        receiverTeamId: recipient.receiverTeamId,
        relatedTaskId: detail.thread.relatedTaskId,
        relatedApprovalId: detail.thread.relatedApprovalId,
        relatedEscalationId: detail.thread.relatedEscalationId,
      });

      setMutationStatus(`Sent canonical message into ${threadId}`);
      void renderRoute();
    } catch (error) {
      setMutationStatus(
        error instanceof Error ? error.message : "Failed to send canonical message",
      );
      void renderRoute();
    }
  });

  delegateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const sourceMessageId = delegateSourceMessageInput?.value.trim() ?? "";
    const originatingTeamId = delegateOriginatingTeamInput?.value.trim() ?? "";
    const assignedTeamId = delegateAssignedTeamInput?.value.trim() ?? "";
    const assignedEmployeeId = delegateAssignedEmployeeInput?.value.trim() ?? "";
    const ownerEmployeeId = delegateOwnerEmployeeInput?.value.trim() ?? "";
    const taskType = delegateTaskTypeInput?.value.trim() ?? "";
    const title = delegateTitleInput?.value.trim() ?? "";
    const rawPayload = delegatePayloadInput?.value ?? "";
    const rawDependsOn = delegateDependsOnInput?.value ?? "";

    if (!sourceMessageId || !originatingTeamId || !assignedTeamId || !taskType || !title) {
      setMutationStatus(
        "Source message, originating team, assigned team, task type, and title are required.",
      );
      void renderRoute();
      return;
    }

    try {
      const detail = await getMessageThreadDetail(threadId);
      const payload = parseOptionalJsonObject(rawPayload);
      const dependsOnTaskIds = rawDependsOn
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean);

      setMutationStatus(`Delegating follow-up task from ${threadId}…`);
      void renderRoute();

      await delegateTaskFromThread({
        threadId,
        companyId: detail.thread.companyId,
        originatingTeamId,
        assignedTeamId,
        ownerEmployeeId: ownerEmployeeId || undefined,
        assignedEmployeeId: assignedEmployeeId || undefined,
        createdByEmployeeId: "human_dashboard_operator",
        taskType,
        title,
        payload,
        dependsOnTaskIds,
        sourceMessageId,
      });

      setMutationStatus(`Delegated follow-up task from ${threadId}`);
      void renderRoute();
    } catch (error) {
      setMutationStatus(
        error instanceof Error ? error.message : "Failed to delegate task from thread",
      );
      void renderRoute();
    }
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='thread-approve']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          setMutationStatus(`Approving from thread ${threadId}…`);
          void renderRoute();
          await approveFromThread(threadId);
          setMutationStatus(`Approved from thread ${threadId}`);
        } catch (error) {
          setMutationStatus(
            error instanceof Error ? error.message : "Failed to approve from thread",
          );
        }
        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='thread-reject']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const note = window.prompt(
          `Rejection note for thread ${threadId}:`,
          "Rejected from canonical thread action.",
        );
        if (note === null) return;

        try {
          setMutationStatus(`Rejecting from thread ${threadId}…`);
          void renderRoute();
          await rejectFromThread(threadId, note);
          setMutationStatus(`Rejected from thread ${threadId}`);
        } catch (error) {
          setMutationStatus(
            error instanceof Error ? error.message : "Failed to reject from thread",
          );
        }
        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='thread-acknowledge-escalation']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          setMutationStatus(`Acknowledging escalation from thread ${threadId}…`);
          void renderRoute();
          await acknowledgeEscalationFromThread(threadId);
          setMutationStatus(`Acknowledged escalation from thread ${threadId}`);
        } catch (error) {
          setMutationStatus(
            error instanceof Error
              ? error.message
              : "Failed to acknowledge escalation from thread",
          );
        }
        void renderRoute();
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-action='thread-resolve-escalation']")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const note = window.prompt(
          `Resolution note for thread ${threadId}:`,
          "Resolved from canonical thread action.",
        );
        if (note === null) return;

        try {
          setMutationStatus(`Resolving escalation from thread ${threadId}…`);
          void renderRoute();
          await resolveEscalationFromThread(threadId, note);
          setMutationStatus(`Resolved escalation from thread ${threadId}`);
        } catch (error) {
          setMutationStatus(
            error instanceof Error
              ? error.message
              : "Failed to resolve escalation from thread",
          );
        }
        void renderRoute();
      });
    });
}

function syncAutoRefresh(): void {
  if (autoRefreshTimer !== null) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!getAutoRefreshEnabled()) {
    return;
  }

  autoRefreshTimer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    lastAutoRefreshAt = Date.now();
    void renderRoute();
  }, AUTO_REFRESH_MS);
}

async function renderRoute(): Promise<void> {
  activeRenderCount += 1;

  const hasExistingShell = Boolean(document.querySelector(".app-shell"));
  if (hasExistingShell) {
    setRefreshingIndicator(true);
  } else {
    renderShell(`<div class="loading">Loading…</div>`);
  }

  try {
    const tenants = await getTenants();
    const homeTenantId = resolveHomeTenantId(tenants);

    const orgHashes = [
      "department",
      "work",
      "intake-projects",
      "product-initiatives",
      "employees",
      "roles",
      "runtime-role-policies",
      "teams",
      "company",
      "mirrors",
      "activity",
      "validation",
    ];

    if (
      !homeTenantId &&
      !orgHashes.includes(window.location.hash.replace(/^#/, ""))
    ) {
      const content = `
        ${renderToolbar({
          autoRefresh: getAutoRefreshEnabled(),
          mutationStatus: mutationStatusMessage,
          liveSurfaceLabel: null,
          liveSurfaceEnabled: false,
          lastRefreshedLabel: formatRefreshAge(lastRenderCompletedAt),
          lastAutoRefreshLabel: lastAutoRefreshAt ? formatRefreshAge(lastAutoRefreshAt) : null,
          isRefreshing: false,
        })}
        ${renderPrimaryNav({
          activeView: "tenant",
          tenantHref: "#department",
        })}
        <section class="card">
          <h2>No tenants available</h2>
          <p class="muted">
            The control-plane returned no tenants for this environment yet.
          </p>
        </section>
      `;
      renderShell(content);
      attachToolbarHandlers();
      syncAutoRefresh();
      return;
    }

    const route = getRoute(homeTenantId ?? "department");

    let content = renderToolbar({
      autoRefresh: getAutoRefreshEnabled(),
      mutationStatus: mutationStatusMessage,
      liveSurfaceLabel: getLiveSurfaceLabel(route),
      liveSurfaceEnabled: isLiveOperationalRoute(route),
      lastRefreshedLabel: formatRefreshAge(lastRenderCompletedAt),
      lastAutoRefreshLabel: lastAutoRefreshAt ? formatRefreshAge(lastAutoRefreshAt) : null,
      isRefreshing: false,
    });

    content += renderPrimaryNav({
      activeView:
        route.kind === "department"
          ? "department"
          : route.kind === "work" || route.kind === "task" || route.kind === "thread"
            ? "work"
            : route.kind === "intakeProjects"
              ? "intake-projects"
              : route.kind === "productInitiatives" || route.kind === "productInitiative"
                ? "product-initiatives"
            : route.kind === "employees" ||
                route.kind === "employee" ||
                route.kind === "roles" ||
                route.kind === "role"
              ? "people"
                : route.kind === "runtimeRolePolicies"
                  ? "runtime-role-policies"
              : route.kind === "teams" ||
                route.kind === "team" ||
                route.kind === "company"
              ? "company"
              : route.kind === "mirrors"
                ? "mirrors"
                : route.kind === "activity"
                  ? "activity"
                  : route.kind === "validation"
                    ? "validation"
              : "tenant",
      tenantHref: `#tenant/${encodeURIComponent(
        route.kind === "department" ||
          route.kind === "work" ||
          route.kind === "intakeProjects" ||
          route.kind === "productInitiatives" ||
          route.kind === "productInitiative" ||
          route.kind === "task" ||
          route.kind === "thread" ||
          route.kind === "employees" ||
          route.kind === "employee" ||
          route.kind === "roles" ||
          route.kind === "role" ||
          route.kind === "runtimeRolePolicies" ||
          route.kind === "teams" ||
          route.kind === "team" ||
          route.kind === "company" ||
            route.kind === "mirrors" ||
            route.kind === "activity" ||
            route.kind === "validation"
          ? (homeTenantId ?? "")
          : route.tenantId,
      )}`,
    });

    if (route.kind === "work") {
      const overview: WorkOverview = {
        tasks: await getWorkTasks(),
        threads: await getMessageThreads(),
      };
      content += renderWorkOverview(overview);
    } else if (route.kind === "intakeProjects") {
      const overview: CompanyWorkIntakeOverview = await getCompanyWorkIntakeOverview();
      content += renderIntakeProjectsOverview(overview);
    } else if (route.kind === "productInitiatives") {
      const projects = await getProductInitiatives();
      content += renderProductInitiativesOverview(projects);
    } else if (route.kind === "productInitiative") {
      const summary = await getProductVisibility(route.projectId);
      content += renderProductInitiativeDetail(summary);
    } else if (route.kind === "task") {
      const detail = await getTaskDetail(route.taskId);
      content += renderTaskDetail(detail);
    } else if (route.kind === "thread") {
      const detail = await getMessageThreadDetail(route.threadId);
      content += renderThreadDetail(detail);
    } else if (
      route.kind === "employees" ||
      route.kind === "employee" ||
      route.kind === "roles" ||
      route.kind === "role" ||
      route.kind === "runtimeRolePolicies" ||
      route.kind === "teams" ||
      route.kind === "team" ||
      route.kind === "company"
    ) {
      const orgOverview: OrgPresenceOverview = await getOrgPresenceOverview();
      const [roles, reviewCycles] = await Promise.all([
        getRoles(),
        getReviewCycles(),
      ]);

      if (route.kind === "employees") {
        content += renderEmployeesDirectory(orgOverview, roles, reviewCycles);
      } else if (route.kind === "employee") {
        const [
          controlOverview,
          effectivePolicy,
          continuityOverview,
          employmentEvents,
          reviews,
        ] = await Promise.all([
          getEmployeeControlOverview(route.employeeId),
          getEmployeeEffectivePolicy(route.employeeId),
          getEmployeeContinuityOverview(route.employeeId),
          getEmployeeEmploymentEvents(route.employeeId),
          getEmployeeReviews(route.employeeId),
        ]);
        content += renderEmployeeDetail(
          orgOverview,
          route.employeeId,
          controlOverview,
          effectivePolicy,
          continuityOverview,
          employmentEvents,
          reviews,
          reviewCycles,
          roles,
        );
      } else if (route.kind === "roles") {
        content += renderRolesCatalog(roles, orgOverview);
      } else if (route.kind === "runtimeRolePolicies") {
        const policies = await getRuntimeRolePolicies();
        content += renderRuntimeRolePoliciesPage({
          roles,
          policies,
          selectedRoleId: route.roleId ?? null,
        });
      } else if (route.kind === "role") {
        content += renderRoleDetail(route.roleId, roles, orgOverview, reviewCycles);
      } else if (route.kind === "teams") {
        content += renderTeamsOverview(orgOverview, latestTeamLoopResults);
      } else if (route.kind === "team") {
        content += renderTeamDetail(
          orgOverview,
          route.teamId,
          getTeamLoopResult(route.teamId),
        );
      } else {
        content += renderCompanyOverview(orgOverview);
      }
    } else if (route.kind === "mirrors") {
      const overview = await getExternalMirrorOverview();
      content += renderExternalMirrorOverview(overview);
    } else if (route.kind === "activity") {
      const timeline = await getNarrativeTimeline();
      content += renderNarrativeTimeline(timeline);
    } else if (route.kind === "validation") {
      const overview = await getValidationOverview();
      content += renderValidationOverview(overview);
    } else if (route.kind === "department") {
      const overview = await getDepartmentOverview();
      const filters = getDepartmentFilters();
      const pagination = getDepartmentPagination();
      content += renderDepartmentOverview({ overview, filters, pagination });
    } else if (route.kind === "service") {
      const overview = await getServiceOverview(route.tenantId, route.serviceId);
      content += renderServiceOverview(overview);
    } else {
      if (homeTenantId && route.tenantId !== homeTenantId) {
        setStoredHomeTenantId(route.tenantId);
      }
      const overview = await getTenantOverview(route.tenantId);
      content += renderTenantOverview(overview);
    }

    renderShell(content);
  lastRenderCompletedAt = Date.now();
    attachToolbarHandlers();

    if (route.kind === "department") {
      attachDepartmentFilterHandlers();
      attachDepartmentActionHandlers();
    }

    if (route.kind === "validation") {
      attachValidationHandlers();
    }

    if (route.kind === "teams" || route.kind === "team") {
      attachTeamLoopHandlers();
    }

    if (route.kind === "intakeProjects") {
      attachIntakeProjectHandlers();
    }

    if (route.kind === "productInitiatives") {
      attachProductInitiativeHandlers();
      attachProductIntakeHandlers();
      return;
    }

    if (route.kind === "productInitiative") {
      attachProductInterventionHandlers();
      attachProductOperatorControlHandlers();
      return;
    }

    if (route.kind === "thread") {
      attachThreadInteractionHandlers(route.threadId);
    }

    if (route.kind === "employees") {
      attachPeopleHandlers();
    }

    if (route.kind === "runtimeRolePolicies") {
      attachRuntimeRolePolicyHandlers();
    }

    if (route.kind === "employee") {
      attachEmployeeManagementHandlers();
    }

    syncAutoRefresh();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown UI error";
    renderShell(`<div class="loading">Unable to load dashboard.</div>`, message);
    syncAutoRefresh();
  } finally {
    activeRenderCount = Math.max(0, activeRenderCount - 1);
    setRefreshingIndicator(activeRenderCount > 0);
  }
}

async function updateDepartmentPaginationView(): Promise<void> {
  try {
    const overview = await getDepartmentOverview();
    const filters = getDepartmentFilters();
    const pagination = getDepartmentPagination();
    const departmentContent = renderDepartmentOverview({ overview, filters, pagination });

    const contentSection = document.querySelector("[data-section='department-content']");
    if (contentSection) {
      contentSection.innerHTML = departmentContent;
      attachDepartmentActionHandlers();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update pagination";
    setMutationStatus(message);
  }
}

window.addEventListener("hashchange", () => {
  void renderRoute();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && getAutoRefreshEnabled()) {
    void renderRoute();
  }
});

void renderRoute();
