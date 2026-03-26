import type {
  ControlHistoryRecord,
  DepartmentOverview,
  EmployeeStateValue,
  EscalationRecord,
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

function renderEmployeeCard(employee: OperatorEmployeeRecord): string {
  return `
    <article class="service-card">
      <div class="service-card-header">
        <div>
          <h3>${escapeHtml(employee.identity.employeeName)}</h3>
          <p class="muted">${escapeHtml(employee.identity.employeeId)} · ${escapeHtml(employee.identity.roleId)}</p>
        </div>
        <span class="${employeeStateSummaryClass(employee.effectiveState.state)}">
          ${escapeHtml(employee.effectiveState.state)}
        </span>
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
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr>
                <td>${renderValue(entry.timestamp)}</td>
                <td><span class="${statusClass(entry.state)}">${escapeHtml(entry.state)}</span></td>
                <td><span class="${statusClass(entry.severity)}">${escapeHtml(entry.severity)}</span></td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                </td>
                <td>${escapeHtml(entry.affectedEmployeeIds.join(", "))}</td>
                <td>${formatExecutionContext(entry.executionContext)}</td>
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
                <td>${renderValue(entry.timestamp)}</td>
                <td><span class="${statusClass(entry.severity)}">${escapeHtml(entry.severity)}</span></td>
                <td>${escapeHtml(entry.employeeId)}</td>
                <td>${escapeHtml(entry.recommendation)}</td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
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
                <td>${renderValue(entry.timestamp)}</td>
                <td>${escapeHtml(entry.employeeId)}</td>
                <td>${escapeHtml(entry.transition)}</td>
                <td>
                  <div class="muted small">from ${renderValue(entry.previousState)}</div>
                  <div>${renderValue(entry.nextState)}</div>
                </td>
                <td>
                  <div>${escapeHtml(entry.reason)}</div>
                  <div class="muted small">${escapeHtml(entry.message)}</div>
                </td>
                <td><pre class="json-block">${formatJsonBlock(entry.evidence)}</pre></td>
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
        ${escapeHtml(run.current_step ?? "—")} · ${escapeHtml(run.updated_at ?? "—")}
      </div>
      <div class="run-badge-actions">
        ${renderOpsConsoleLink(run)}
      </div>
    </div>
  `;
}

export function renderToolbar(args: {
  autoRefresh: boolean;
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="toolbar">
        <div class="toolbar-group">
          <p class="muted">Tenant-facing view plus operator governance surface.</p>
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
                                    <td>${renderValue(run.updated_at)}</td>
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

export function renderDepartmentOverview(overview: DepartmentOverview): string {
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
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Employees</h2>
      </div>
      <div class="service-grid">
        ${overview.employees.map(renderEmployeeCard).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Escalations</h2>
      </div>
      ${renderEscalationsTable(overview.escalations)}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Manager decisions</h2>
      </div>
      ${renderManagerLogTable(overview.managerLog)}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Control history</h2>
      </div>
      ${renderControlHistoryTable(overview.controlHistory)}
    </section>
  `;
}
