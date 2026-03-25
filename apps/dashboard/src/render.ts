import type {
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
      return "status status-completed";
    case "failed":
      return "status status-failed";
    case "waiting":
      return "status status-waiting";
    case "running":
      return "status status-running";
    default:
      return "status";
  }
}

function renderValue(value: unknown): string {
  return escapeHtml(value ?? "—");
}

function renderOpsConsoleLink(run: RunSummary | null): string {
  if (!run) return "";

  return `
    <a
      class="secondary-link"
      href="http://localhost:5174/#run/${encodeURIComponent(run.run_id)}"
      target="_blank"
      rel="noreferrer"
    >
      Open in ops console
    </a>
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
          <p class="muted">Tenant-facing service and environment view.</p>
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
