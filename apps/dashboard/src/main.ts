function getDashboardBuildCommit(): string {
  const configured = import.meta.env.VITE_BUILD_COMMIT;
  return (configured && configured.trim()) || "dev";
}

function getDashboardBuildDate(): string {
  const configured = import.meta.env.VITE_BUILD_DATE;
  return (configured && configured.trim()) || "local build";
}
import {
  acknowledgeEscalation,
  acknowledgeEscalationFromThread,
  approveApproval,
  approveFromThread,
  createCanonicalThreadMessage,
  delegateTaskFromThread,
  getApiBaseUrl,
  getEmployeeContinuityOverview,
  getEmployeeControlOverview,
  getEmployeeEffectivePolicy,
  getExternalMirrorOverview,
  getMessageThreadDetail,
  getMessageThreads,
  getNarrativeTimeline,
  getDepartmentOverview,
  getOrgPresenceOverview,
  getTaskDetail,
  getWorkTasks,
  getOperatorAgentBaseUrl,
  getServiceOverview,
  getTenantOverview,
  getTenants,
  rejectApproval,
  rejectFromThread,
  resolveEscalation,
  resolveEscalationFromThread,
} from "./api";
import type {
  DepartmentFilters,
  DepartmentPaginationState,
  OrgPresenceOverview,
  PageSize,
  TenantSummary,
  WorkOverview,
} from "./types";
import {
  renderCompanyOverview,
  renderDepartmentOverview,
  renderEmployeeDetail,
  renderEmployeesDirectory,
  renderExternalMirrorOverview,
  renderNarrativeTimeline,
  renderPrimaryNav,
  renderServiceOverview,
  renderTaskDetail,
  renderTeamDetail,
  renderTeamsOverview,
  renderThreadDetail,
  renderTenantOverview,
  renderToolbar,
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
const INTERNAL_TENANT_ID_CANDIDATES = [
  "internal",
  "company_internal_aep",
  "tenant_internal_aep",
] as const;
let autoRefreshTimer: number | null = null;
let mutationStatusMessage: string | null = null;

type Route =
  | { kind: "tenant"; tenantId: string }
  | { kind: "service"; tenantId: string; serviceId: string }
  | { kind: "work" }
  | { kind: "task"; taskId: string }
  | { kind: "thread"; threadId: string }
  | { kind: "employees" }
  | { kind: "employee"; employeeId: string }
  | { kind: "teams" }
  | { kind: "team"; teamId: string }
  | { kind: "company" }
  | { kind: "mirrors" }
  | { kind: "activity" }
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

  if (hash === "employees") {
    return { kind: "employees" };
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
          <div>Control plane: ${getApiBaseUrl()}</div>
          <div>Operator agent: ${getOperatorAgentBaseUrl()}</div>
          <div class="build-meta">
            <div>Dashboard build: ${getDashboardBuildCommit()}</div>
            <div>${getDashboardBuildDate()}</div>
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
    void renderRoute();
  }, AUTO_REFRESH_MS);
}

async function renderRoute(): Promise<void> {
  renderShell(`<div class="loading">Loading…</div>`);

  try {
    const tenants = await getTenants();
    const homeTenantId = resolveHomeTenantId(tenants);

    const orgHashes = [
      "department",
      "work",
      "employees",
      "teams",
      "company",
      "mirrors",
      "activity",
    ];

    if (
      !homeTenantId &&
      !orgHashes.includes(window.location.hash.replace(/^#/, ""))
    ) {
      const content = `
        ${renderToolbar({
          autoRefresh: getAutoRefreshEnabled(),
          mutationStatus: mutationStatusMessage,
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
    });

    content += renderPrimaryNav({
      activeView:
        route.kind === "department"
          ? "department"
          : route.kind === "work" || route.kind === "task" || route.kind === "thread"
            ? "work"
            : route.kind === "employees" ||
                route.kind === "employee" ||
                route.kind === "teams" ||
                route.kind === "team" ||
                route.kind === "company"
              ? "company"
              : route.kind === "mirrors"
                ? "mirrors"
                : route.kind === "activity"
                  ? "activity"
              : "tenant",
      tenantHref: `#tenant/${encodeURIComponent(
        route.kind === "department" ||
          route.kind === "work" ||
          route.kind === "task" ||
          route.kind === "thread" ||
          route.kind === "employees" ||
          route.kind === "employee" ||
          route.kind === "teams" ||
          route.kind === "team" ||
          route.kind === "company" ||
            route.kind === "mirrors" ||
            route.kind === "activity"
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
    } else if (route.kind === "task") {
      const detail = await getTaskDetail(route.taskId);
      content += renderTaskDetail(detail);
    } else if (route.kind === "thread") {
      const detail = await getMessageThreadDetail(route.threadId);
      content += renderThreadDetail(detail);
    } else if (
      route.kind === "employees" ||
      route.kind === "employee" ||
      route.kind === "teams" ||
      route.kind === "team" ||
      route.kind === "company"
    ) {
      const orgOverview: OrgPresenceOverview = await getOrgPresenceOverview();

      if (route.kind === "employees") {
        content += renderEmployeesDirectory(orgOverview);
      } else if (route.kind === "employee") {
        const [controlOverview, effectivePolicy, continuityOverview] = await Promise.all([
          getEmployeeControlOverview(route.employeeId),
          getEmployeeEffectivePolicy(route.employeeId),
          getEmployeeContinuityOverview(route.employeeId),
        ]);
        content += renderEmployeeDetail(
          orgOverview,
          route.employeeId,
          controlOverview,
          effectivePolicy,
          continuityOverview,
        );
      } else if (route.kind === "teams") {
        content += renderTeamsOverview(orgOverview);
      } else if (route.kind === "team") {
        content += renderTeamDetail(orgOverview, route.teamId);
      } else {
        content += renderCompanyOverview(orgOverview);
      }
    } else if (route.kind === "mirrors") {
      const overview = await getExternalMirrorOverview();
      content += renderExternalMirrorOverview(overview);
    } else if (route.kind === "activity") {
      const timeline = await getNarrativeTimeline();
      content += renderNarrativeTimeline(timeline);
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
    attachToolbarHandlers();

    if (route.kind === "department") {
      attachDepartmentFilterHandlers();
      attachDepartmentActionHandlers();
    }

    if (route.kind === "thread") {
      attachThreadInteractionHandlers(route.threadId);
    }

    syncAutoRefresh();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown UI error";
    renderShell(`<div class="loading">Unable to load dashboard.</div>`, message);
    syncAutoRefresh();
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

void renderRoute();
