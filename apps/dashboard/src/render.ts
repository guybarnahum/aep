import type {
  ApprovalActionFilter,
  ApprovalRecord,
  ApprovalStatusFilter,
  ControlHistoryRecord,
  DecisionSeverityFilter,
  DepartmentFilters,
  DepartmentOverview,
  EmployeeStateFilter,
  EmployeeStateValue,
  EscalationRecord,
  EscalationStateFilter,
  ManagerDecisionRecord,
  OperatorEmployeeRecord,
  RunSummary,
  ServiceOverview,
  TenantOverview,
  TenantSummary,
} from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
    case "enabled":
    case "resolved":
      return "status status-completed";
    case "failed":
    case "critical":
    case "disabled_by_manager":
      return "status status-failed";
    case "waiting":
    case "acknowledged":
    case "disabled_pending_review":
    case "expired":
      return "status status-waiting";
    case "running":
      return "status status-running";
    case "restricted":
    case "warning":
      return "status status-restricted";
    case "open":
      return "status status-open";
    default:
      return "status";
  }
}

function renderValue(value: unknown): string {
  return escapeHtml(value ?? "—");
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return escapeHtml(value);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let relative: string;
  if (diffSec < 60) {
    relative = "just now";
  } else if (diffMin < 60) {
    relative = `${diffMin}m ago`;
  } else if (diffHour < 24) {
    relative = `${diffHour}h ${diffMin % 60}m ago`;
  } else if (diffDay < 7) {
    relative = `${diffDay}d ago`;
  } else {
    relative = "";
  }

  const absolute = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const title = d.toISOString();

  if (relative) {
    return `<span title="${escapeHtml(title)}" class="timestamp">${escapeHtml(relative)} <span class="muted small">${escapeHtml(absolute)}</span></span>`;
  }
  return `<span title="${escapeHtml(title)}" class="timestamp">${escapeHtml(absolute)}</span>`;
}

function formatJsonBlock(value: unknown): string {
  if (!value) {
    return "—";
  }

  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

function formatExecutionContext(
  value:
    | {
        executionSource?: string;
        companyId?: string;
        taskId?: string;
        heartbeatId?: string;
        executorId?: string;
      }
    | undefined,
): string {
  if (!value) {
    return "—";
  }

  const parts = [
    value.executionSource,
    value.companyId ? `company=${value.companyId}` : null,
    value.taskId ? `task=${value.taskId}` : null,
    value.heartbeatId ? `heartbeat=${value.heartbeatId}` : null,
    value.executorId ? `executor=${value.executorId}` : null,
  ].filter(Boolean);

  return escapeHtml(parts.join(" · "));
}

function getOpsConsoleBaseUrl(): string {
  const configured = import.meta.env.VITE_OPS_CONSOLE_BASE_URL;
  return (configured && configured.trim()) || "http://localhost:5174";
}

function renderOpsConsoleLink(run: RunSummary | null): string {
  if (!run) return "";

  return `
    <a
      class="secondary-link"
      href="${escapeHtml(getOpsConsoleBaseUrl())}/#run/${encodeURIComponent(run.run_id)}"
      target="_blank"
      rel="noreferrer"
    >
      Open in ops console
    </a>
  `;
}

function employeeStateSummaryClass(state: EmployeeStateValue): string {
  return statusClass(state);
}

function renderSummaryCard(title: string, value: string | number, detail: string): string {
  return `
    <article class="summary-card">
      <div class="summary-card-label">${escapeHtml(title)}</div>
      <div class="summary-card-value">${escapeHtml(value)}</div>
      <div class="muted small">${escapeHtml(detail)}</div>
    </article>
  `;
}

function clampPage(page: number, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
} {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = clampPage(page, totalItems, pageSize);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page: safePage,
    totalPages,
    totalItems,
  };
}

function renderPager(args: {
  section:
    | "employees"
    | "escalations"
    | "managerLog"
    | "controlHistory"
    | "approvals";
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: 10 | 20 | 50;
}): string {
  return `
    <div class="pager">
      <div class="pager-left muted small">
        ${escapeHtml(args.totalItems)} items
      </div>

      <div class="pager-center">
        <button
          type="button"
          class="button button-small button-secondary"
          data-action="page-prev"
          data-section="${args.section}"
          ${args.page <= 1 ? "disabled" : ""}
        >
          Prev
        </button>

        <span class="pager-label muted small">
          Page ${escapeHtml(args.page)} / ${escapeHtml(args.totalPages)}
        </span>

        <button
          type="button"
          class="button button-small button-secondary"
          data-action="page-next"
          data-section="${args.section}"
          ${args.page >= args.totalPages ? "disabled" : ""}
        >
          Next
        </button>
      </div>

      <div class="pager-right">
        <label class="pager-size-label">
          <span class="muted small">Rows</span>
          <select
            class="pager-size-select"
            data-action="page-size"
            data-section="${args.section}"
          >
            ${([10, 20, 50] as const)
              .map(
                (size) => `
                  <option value="${size}" ${args.pageSize === size ? "selected" : ""}>
                    ${size}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>
    </div>
  `;
}

function renderExpandableText(id: string, label: string, content: string): string {
  return `
    <details class="expandable-block" id="${escapeHtml(id)}">
      <summary>${escapeHtml(label)}</summary>
      <pre class="json-block scroll-block">${content}</pre>
    </details>
  `;
}

function renderApprovalActions(entry: ApprovalRecord): string {
  if (entry.status !== "pending") {
    return `<span class="muted small">${escapeHtml(entry.status)}</span>`;
  }

  return `
    <div class="table-actions">
      <button
        type="button"
        class="button button-small"
        data-action="approve-approval"
        data-approval-id="${escapeHtml(entry.approvalId)}"
      >
        Approve
      </button>
      <button
        type="button"
        class="button button-small button-secondary"
        data-action="reject-approval"
        data-approval-id="${escapeHtml(entry.approvalId)}"
      >
        Reject
      </button>
    </div>
  `;
}

function renderApprovalLinkage(entry: ApprovalRecord): string {
  return `
    <div class="approval-meta">
      <div class="muted small">id=${escapeHtml(entry.approvalId)}</div>
      <div class="muted small">source=${escapeHtml(entry.source)}</div>
      ${entry.expiresAt ? `<div class="muted small">expires=${formatTimestamp(entry.expiresAt)}</div>` : ""}
      <div class="muted small">decision=${escapeHtml(entry.decidedBy ?? "-")} @ ${formatTimestamp(entry.decidedAt)}</div>
      ${entry.decisionNote ? `<div class="muted small">note=${escapeHtml(entry.decisionNote)}</div>` : ""}
      ${entry.executionId ? `<div class="muted small">exec=${escapeHtml(entry.executionId)}</div>` : ""}
      ${entry.executedAt ? `<div class="muted small">executed=${formatTimestamp(entry.executedAt)}</div>` : ""}
    </div>
  `;
}

function renderApprovalsTable(entries: ApprovalRecord[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No approvals recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Status</th>
          <th>Action</th>
          <th>Target employee</th>
          <th>Requested by</th>
          <th>Reason</th>
          <th>Provenance / execution</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map((entry) => {
            const payload = entry.payload ?? {};
            const targetEmployeeId =
              typeof payload.targetEmployeeId === "string"
                ? payload.targetEmployeeId
                : null;

            return `
              <tr>
                <td>${formatTimestamp(entry.timestamp)}</td>
                <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
                <td>${escapeHtml(entry.actionType)}</td>
                <td>${targetEmployeeId ? `<div class="inline-chip-row"><span>${escapeHtml(targetEmployeeId)}</span>${renderEmployeeJumpButton(targetEmployeeId)}</div>` : "-"}</td>
                <td>
                  <div>${escapeHtml(entry.requestedByEmployeeName ?? entry.requestedByEmployeeId)}</div>
                  <div class="muted small">${escapeHtml(entry.requestedByRoleId)}</div>
                </td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                  ${renderExpandableText(
                    `approval-payload-${entry.approvalId}`,
                    "Payload",
                    formatJsonBlock(entry.payload),
                  )}
                </td>
                <td>${renderApprovalLinkage(entry)}</td>
                <td>${renderApprovalActions(entry)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderEmployeeJumpButton(employeeId: string): string {
  return `
    <button
      type="button"
      class="button button-small button-secondary"
      data-action="select-employee"
      data-employee-id="${escapeHtml(employeeId)}"
    >
      Focus
    </button>
  `;
}

function renderEmployeeCard(employee: OperatorEmployeeRecord, selectedEmployeeId: string | null): string {
  const isSelected = selectedEmployeeId === employee.identity.employeeId;
  return `
    <article class="service-card ${isSelected ? "service-card-selected" : ""}">
      <div class="service-card-header">
        <div>
          <h3>${escapeHtml(employee.identity.employeeName)}</h3>
          <p class="muted">${escapeHtml(employee.identity.employeeId)} · ${escapeHtml(employee.identity.roleId)}</p>
        </div>
        <div class="card-actions">
          ${renderEmployeeJumpButton(employee.identity.employeeId)}
          <span class="${employeeStateSummaryClass(employee.effectiveState.state)}">
            ${escapeHtml(employee.effectiveState.state)}
          </span>
        </div>
      </div>

      <div class="governance-grid">
        <div>
          <div class="muted small">Blocked</div>
          <div>${employee.effectiveState.blocked ? "yes" : "no"}</div>
        </div>
        <div>
          <div class="muted small">Trace verification</div>
          <div>${employee.effectiveAuthority.requireTraceVerification ? "required" : "not required"}</div>
        </div>
        <div>
          <div class="muted small">Tenants</div>
          <div>${renderValue(employee.effectiveAuthority.allowedTenants?.join(", "))}</div>
        </div>
        <div>
          <div class="muted small">Services</div>
          <div>${renderValue(employee.effectiveAuthority.allowedServices?.join(", "))}</div>
        </div>
        <div>
          <div class="muted small">Max actions / scan</div>
          <div>${renderValue(employee.effectiveBudget.maxActionsPerScan)}</div>
        </div>
        <div>
          <div class="muted small">Max actions / hour</div>
          <div>${renderValue(employee.effectiveBudget.maxActionsPerHour)}</div>
        </div>
      </div>
    </article>
  `;
}

function renderEscalationActions(entry: EscalationRecord): string {
  if (entry.state === "resolved") {
    return `<span class="muted small">Resolved</span>`;
  }

  const acknowledgeButton =
    entry.state === "open"
      ? `
        <button
          type="button"
          class="button button-small"
          data-action="acknowledge-escalation"
          data-escalation-id="${escapeHtml(entry.escalationId)}"
        >
          Acknowledge
        </button>
      `
      : "";

  return `
    <div class="table-actions">
      ${acknowledgeButton}
      <button
        type="button"
        class="button button-small button-secondary"
        data-action="resolve-escalation"
        data-escalation-id="${escapeHtml(entry.escalationId)}"
      >
        Resolve
      </button>
    </div>
  `;
}

function renderEscalationsTable(entries: EscalationRecord[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No escalations recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>State</th>
          <th>Severity</th>
          <th>Reason</th>
          <th>Employees</th>
          <th>Execution source</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr>
                <td>${formatTimestamp(entry.timestamp)}</td>
                <td><span class="${statusClass(entry.state)}">${escapeHtml(entry.state)}</span></td>
                <td><span class="${statusClass(entry.severity)}">${escapeHtml(entry.severity)}</span></td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                  ${renderExpandableText(
                    `evidence-${entry.escalationId}`,
                    "Evidence",
                    formatJsonBlock(entry.evidence),
                  )}
                </td>
                <td>${entry.affectedEmployeeIds.map((id) => `
                  <div class="inline-chip-row">
                    <span>${escapeHtml(id)}</span>
                    ${renderEmployeeJumpButton(id)}
                  </div>
                `).join("")}</td>
                <td>${formatExecutionContext(entry.executionContext)}</td>
                <td>${renderEscalationActions(entry)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderManagerLogTable(entries: ManagerDecisionRecord[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No manager decisions recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Employee</th>
          <th>Recommendation</th>
          <th>Reason</th>
          <th>Execution source</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr>
                <td>${formatTimestamp(entry.timestamp)}</td>
                <td><span class="${statusClass(entry.severity)}">${escapeHtml(entry.severity)}</span></td>
                <td>
                  <div class="inline-chip-row">
                    <span>${escapeHtml(entry.employeeId)}</span>
                    ${renderEmployeeJumpButton(entry.employeeId)}
                  </div>
                </td>
                <td>${escapeHtml(entry.recommendation)}</td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                  ${entry.approvalRequired ? `
                    <div class="muted small">
                      approval=${escapeHtml(entry.approvalStatus ?? "-")} · gate=${escapeHtml(entry.approvalGateStatus ?? "-")}
                    </div>
                    <div class="muted small">id=${escapeHtml(entry.approvalId ?? "-")}</div>
                    ${entry.approvalExecutionId ? `<div class="muted small">exec=${escapeHtml(entry.approvalExecutionId)}</div>` : ""}
                  ` : ""}
                  ${renderExpandableText(
                    `decision-evidence-${entry.timestamp}-${entry.employeeId}`,
                    "Evidence",
                    formatJsonBlock(entry.evidence),
                  )}
                </td>
                <td>${formatExecutionContext(entry.executionContext)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderControlHistoryTable(entries: ControlHistoryRecord[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No control history recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Employee</th>
          <th>Transition</th>
          <th>State</th>
          <th>Reason</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr>
                <td>${formatTimestamp(entry.timestamp)}</td>
                <td>
                  <div class="inline-chip-row">
                    <span>${escapeHtml(entry.employeeId)}</span>
                    ${renderEmployeeJumpButton(entry.employeeId)}
                  </div>
                </td>
                <td>${escapeHtml(entry.transition)}</td>
                <td>
                  <div class="muted small">from ${renderValue(entry.previousState)}</div>
                  <div>${renderValue(entry.nextState)}</div>
                </td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                </td>
                <td>
                  ${renderExpandableText(
                    `history-evidence-${entry.historyId}`,
                    "Evidence",
                    formatJsonBlock(entry.evidence),
                  )}
                  ${entry.approvalId ? `
                    <div class="muted small">approval=${escapeHtml(entry.approvalId)}</div>
                    <div class="muted small">approved execution=${escapeHtml(entry.approvalExecutionId ?? "-")}</div>
                    <div class="muted small">executed=${formatTimestamp(entry.approvalExecutedAt)}</div>
                  ` : ""}
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderRunBadge(run: RunSummary | null): string {
  if (!run) {
    return `<div class="empty-state small-empty">No runs yet.</div>`;
  }

  return `
    <div class="run-badge">
      <div class="run-badge-top">
        <a href="${escapeHtml(run.trace_path)}" target="_blank" rel="noreferrer">${escapeHtml(run.run_id)}</a>
        <span class="${statusClass(run.status)}">${renderValue(run.status)}</span>
      </div>
      <div class="muted small">
        ${escapeHtml(run.current_step ?? "—")} · ${formatTimestamp(run.updated_at)}
      </div>
      <div class="run-badge-actions">
        ${renderOpsConsoleLink(run)}
      </div>
    </div>
  `;
}

export function renderToolbar(args: {
  autoRefresh: boolean;
  mutationStatus?: string | null;
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="toolbar">
        <div class="toolbar-group">
          <p class="muted">Tenant-facing view plus operator governance surface.</p>
          ${args.mutationStatus ? `<p class="mutation-status">${escapeHtml(args.mutationStatus)}</p>` : ""}
        </div>

        <div class="toolbar-group toolbar-actions">
          <label class="checkbox-label">
            <input id="auto-refresh-toggle" type="checkbox" ${args.autoRefresh ? "checked" : ""} />
            <span>Auto-refresh (15s)</span>
          </label>
          <button id="refresh-button" class="button" type="button">Refresh</button>
        </div>
      </div>
    </section>
  `;
}

export function renderPrimaryNav(args: {
  activeView: "tenant" | "department";
  tenantHref: string;
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="view-nav">
        <a class="view-nav-link ${args.activeView === "tenant" ? "view-nav-link-active" : ""}" href="${escapeHtml(args.tenantHref)}">
          Tenant view
        </a>
        <a class="view-nav-link ${args.activeView === "department" ? "view-nav-link-active" : ""}" href="#department">
          Department view
        </a>
      </div>
    </section>
  `;
}

export function renderDepartmentFilters(args: {
  filters: DepartmentFilters;
  employees: OperatorEmployeeRecord[];
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="filter-grid">
        <label class="filter-field">
          <span>Employee</span>
          <select id="employee-filter">
            <option value="">All employees</option>
            ${args.employees
              .map(
                (employee) => `
                  <option
                    value="${escapeHtml(employee.identity.employeeId)}"
                    ${args.filters.selectedEmployeeId === employee.identity.employeeId ? "selected" : ""}
                  >
                    ${escapeHtml(employee.identity.employeeName)} (${escapeHtml(employee.identity.employeeId)})
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <label class="filter-field">
          <span>Escalation state</span>
          <select id="escalation-state-filter">
            ${(["all", "open", "acknowledged", "resolved"] as EscalationStateFilter[])
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.escalationState === value ? "selected" : ""}>
                    ${escapeHtml(value)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <label class="filter-field">
          <span>Decision severity</span>
          <select id="decision-severity-filter">
            ${(["all", "warning", "critical"] as DecisionSeverityFilter[])
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.decisionSeverity === value ? "selected" : ""}>
                    ${escapeHtml(value)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <label class="filter-field">
          <span>Employee state</span>
          <select id="employee-state-filter">
            ${(
              [
                "all",
                "enabled",
                "disabled_pending_review",
                "disabled_by_manager",
                "restricted",
              ] as EmployeeStateFilter[]
            )
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.employeeState === value ? "selected" : ""}>
                    ${escapeHtml(value)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <label class="filter-field">
          <span>Approval status</span>
          <select id="approval-status-filter">
            ${(["all", "pending", "approved", "rejected", "expired"] as ApprovalStatusFilter[])
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.approvalStatus === value ? "selected" : ""}>
                    ${escapeHtml(value)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <label class="filter-field">
          <span>Approval action</span>
          <select id="approval-action-filter">
            ${(["all", "disable_employee", "restrict_employee"] as ApprovalActionFilter[])
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.approvalAction === value ? "selected" : ""}>
                    ${escapeHtml(value)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>

        <div class="filter-actions">
          <button id="clear-filters-button" class="button button-secondary" type="button">
            Clear filters
          </button>
        </div>
      </div>
    </section>
  `;
}

export function renderTenantSelector(
  tenants: TenantSummary[],
  selectedTenantId: string,
): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Tenants</h2>
      </div>

      <div class="tenant-grid">
        ${tenants
          .map(
            (tenant) => `
              <a
                class="tenant-card ${tenant.tenant_id === selectedTenantId ? "tenant-card-active" : ""}"
                href="#tenant/${encodeURIComponent(tenant.tenant_id)}"
              >
                <div class="tenant-card-top">
                  <h3>${escapeHtml(tenant.name)}</h3>
                  <span class="muted small">${escapeHtml(tenant.source ?? "seeded")}</span>
                </div>
                <div class="tenant-stats">
                  <span>${renderValue(tenant.service_count)} services</span>
                  <span>${renderValue(tenant.environment_count)} environments</span>
                </div>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderTenantOverview(overview: TenantOverview): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(overview.tenant.name)}</h2>
        <p class="muted">${escapeHtml(overview.tenant.tenant_id)}</p>
      </div>

      <div class="service-grid">
        ${overview.services
          .map(
            (service) => `
              <article class="service-card">
                <div class="service-card-header">
                  <div>
                    <h3>
                      <a href="#tenant/${encodeURIComponent(overview.tenant.tenant_id)}/service/${encodeURIComponent(service.service_id)}">
                        ${escapeHtml(service.service_name)}
                      </a>
                    </h3>
                    <p class="muted">${escapeHtml(service.provider ?? "—")}</p>
                  </div>
                </div>

                <div class="environment-list">
                  ${service.environments
                    .map(
                      (environment) => `
                        <div class="environment-row">
                          <div>
                            <strong>${escapeHtml(environment.environment_name)}</strong>
                          </div>
                          <div>
                            ${renderRunBadge(environment.latest_run)}
                          </div>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderServiceOverview(overview: ServiceOverview): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <a class="back-link" href="#tenant/${encodeURIComponent(overview.tenant.tenant_id)}">← Back to tenant</a>
        <h2>${escapeHtml(overview.service.service_name)}</h2>
        <p class="muted">${escapeHtml(overview.tenant.name)} · ${escapeHtml(overview.service.provider ?? "—")}</p>
      </div>

      <div class="environment-stack">
        ${overview.environments
          .map(
            (environment) => `
              <article class="service-card">
                <div class="service-card-header">
                  <div>
                    <h3>${escapeHtml(environment.environment_name)}</h3>
                    <p class="muted">Latest run</p>
                  </div>
                  ${environment.latest_run ? `<span class="${statusClass(environment.latest_run.status)}">${escapeHtml(environment.latest_run.status)}</span>` : ""}
                </div>

                ${renderRunBadge(environment.latest_run)}

                <div class="recent-runs">
                  <h4>Recent runs</h4>
                  ${
                    environment.recent_runs.length > 0
                      ? `
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th>Run</th>
                              <th>Status</th>
                              <th>Step</th>
                              <th>Updated</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            ${environment.recent_runs
                              .map(
                                (run) => `
                                  <tr>
                                    <td><a href="${escapeHtml(run.trace_path)}" target="_blank" rel="noreferrer">${escapeHtml(run.run_id)}</a></td>
                                    <td><span class="${statusClass(run.status)}">${escapeHtml(run.status)}</span></td>
                                    <td>${renderValue(run.current_step)}</td>
                                    <td>${formatTimestamp(run.updated_at)}</td>
                                    <td>${renderOpsConsoleLink(run)}</td>
                                  </tr>
                                `,
                              )
                              .join("")}
                          </tbody>
                        </table>
                      `
                      : `<div class="empty-state small-empty">No recent runs.</div>`
                  }
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderDepartmentOverview(args: {
  overview: DepartmentOverview;
  filters: DepartmentFilters;
  pagination: {
    employees: { page: number; pageSize: 10 | 20 | 50 };
    escalations: { page: number; pageSize: 10 | 20 | 50 };
    managerLog: { page: number; pageSize: 10 | 20 | 50 };
    controlHistory: { page: number; pageSize: 10 | 20 | 50 };
    approvals: { page: number; pageSize: 10 | 20 | 50 };
  };
}): string {
  const { overview, filters, pagination } = args;

  const filteredEmployees = overview.employees.filter((employee) => {
    const matchesSelectedEmployee =
      !filters.selectedEmployeeId ||
      employee.identity.employeeId === filters.selectedEmployeeId;

    const matchesEmployeeState =
      filters.employeeState === "all" ||
      employee.effectiveState.state === filters.employeeState;

    return matchesSelectedEmployee && matchesEmployeeState;
  });

  const filteredEscalations = overview.escalations.filter((entry) => {
    const matchesSelectedEmployee =
      !filters.selectedEmployeeId ||
      entry.affectedEmployeeIds.includes(filters.selectedEmployeeId);

    const matchesState =
      filters.escalationState === "all" || entry.state === filters.escalationState;

    return matchesSelectedEmployee && matchesState;
  });

  const filteredManagerLog = overview.managerLog.filter((entry) => {
    const matchesSelectedEmployee =
      !filters.selectedEmployeeId || entry.employeeId === filters.selectedEmployeeId;

    const matchesSeverity =
      filters.decisionSeverity === "all" ||
      entry.severity === filters.decisionSeverity;

    return matchesSelectedEmployee && matchesSeverity;
  });

  const filteredControlHistory = overview.controlHistory.filter((entry) => {
    return !filters.selectedEmployeeId || entry.employeeId === filters.selectedEmployeeId;
  });

  const filteredApprovals = overview.approvals.filter((entry) => {
    const payload = entry.payload ?? {};
    const targetEmployeeId =
      typeof payload.targetEmployeeId === "string" ? payload.targetEmployeeId : null;

    const matchesSelectedEmployee =
      !filters.selectedEmployeeId ||
      entry.requestedByEmployeeId === filters.selectedEmployeeId ||
      targetEmployeeId === filters.selectedEmployeeId;

    const matchesApprovalStatus =
      filters.approvalStatus === "all" || entry.status === filters.approvalStatus;

    const matchesApprovalAction =
      filters.approvalAction === "all" || entry.actionType === filters.approvalAction;

    return matchesSelectedEmployee && matchesApprovalStatus && matchesApprovalAction;
  });

  const pagedEmployees = paginate(
    filteredEmployees,
    pagination.employees.page,
    pagination.employees.pageSize,
  );

  const pagedEscalations = paginate(
    filteredEscalations,
    pagination.escalations.page,
    pagination.escalations.pageSize,
  );

  const pagedManagerLog = paginate(
    filteredManagerLog,
    pagination.managerLog.page,
    pagination.managerLog.pageSize,
  );

  const pagedControlHistory = paginate(
    filteredControlHistory,
    pagination.controlHistory.page,
    pagination.controlHistory.pageSize,
  );

  const pagedApprovals = paginate(
    filteredApprovals,
    pagination.approvals.page,
    pagination.approvals.pageSize,
  );

  const blockedEmployees = overview.employees.filter(
    (employee) => employee.effectiveState.blocked,
  ).length;

  const openEscalations = overview.escalations.filter(
    (entry) => entry.state === "open",
  ).length;

  const restrictedEmployees = overview.employees.filter(
    (employee) => employee.effectiveState.state === "restricted",
  ).length;

  return `
    <div data-section="department-content">
      <section class="panel">
        <div class="panel-header">
          <h2>Infra department</h2>
          <p class="muted">Employees, escalations, controls, and manager decisions.</p>
        </div>

        <div class="summary-grid">
          ${renderSummaryCard(
            "Primary scheduler",
            overview.schedulerStatus.primaryScheduler,
            overview.schedulerStatus.cronFallbackEnabled ? "cron fallback enabled" : "cron fallback disabled",
          )}
          ${renderSummaryCard(
            "Employees",
            overview.employees.length,
            `${blockedEmployees} blocked · ${restrictedEmployees} restricted`,
          )}
          ${renderSummaryCard(
            "Open escalations",
            openEscalations,
            `${overview.escalations.length} total escalations`,
          )}
          ${renderSummaryCard(
            "Manager decisions",
            overview.managerLog.length,
            `${overview.controlHistory.length} control-history entries`,
          )}
          ${renderSummaryCard(
            "Pending approvals",
            overview.approvals.filter((entry) => entry.status === "pending").length,
            `${overview.approvals.length} total approvals`,
          )}
        </div>
      </section>

      ${renderDepartmentFilters({ filters, employees: overview.employees })}

      <section class="panel">
        <div class="panel-header">
          <h2>Employees</h2>
          <p class="muted">${pagedEmployees.totalItems} shown</p>
        </div>
        ${renderPager({
          section: "employees",
          page: pagedEmployees.page,
          totalPages: pagedEmployees.totalPages,
          totalItems: pagedEmployees.totalItems,
          pageSize: pagination.employees.pageSize,
        })}
        <div class="service-grid">
          ${pagedEmployees.items.map((employee) => renderEmployeeCard(employee, filters.selectedEmployeeId)).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Escalations</h2>
          <p class="muted">${pagedEscalations.totalItems} shown</p>
        </div>
        ${renderPager({
          section: "escalations",
          page: pagedEscalations.page,
          totalPages: pagedEscalations.totalPages,
          totalItems: pagedEscalations.totalItems,
          pageSize: pagination.escalations.pageSize,
        })}
        ${renderEscalationsTable(pagedEscalations.items)}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Manager decisions</h2>
          <p class="muted">${pagedManagerLog.totalItems} shown</p>
        </div>
        ${renderPager({
          section: "managerLog",
          page: pagedManagerLog.page,
          totalPages: pagedManagerLog.totalPages,
          totalItems: pagedManagerLog.totalItems,
          pageSize: pagination.managerLog.pageSize,
        })}
        ${renderManagerLogTable(pagedManagerLog.items)}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Approvals</h2>
          <p class="muted">${pagedApprovals.totalItems} shown</p>
        </div>
        ${renderPager({
          section: "approvals",
          page: pagedApprovals.page,
          totalPages: pagedApprovals.totalPages,
          totalItems: pagedApprovals.totalItems,
          pageSize: pagination.approvals.pageSize,
        })}
        ${renderApprovalsTable(pagedApprovals.items)}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Control history</h2>
          <p class="muted">${pagedControlHistory.totalItems} shown</p>
        </div>
        ${renderPager({
          section: "controlHistory",
          page: pagedControlHistory.page,
          totalPages: pagedControlHistory.totalPages,
          totalItems: pagedControlHistory.totalItems,
          pageSize: pagination.controlHistory.pageSize,
        })}
        ${renderControlHistoryTable(pagedControlHistory.items)}
      </section>
    </div>
  `;
}
