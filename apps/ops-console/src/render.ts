import type { RunDetail, RunJobView, RunSummary } from "./types";

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

function renderAdvanceTimeoutControl(job: RunJobView): string {
  if (job.operator_actions.can_advance_timeout) {
    return `
      <button
        class="button advance-timeout-button"
        type="button"
        data-job-id="${escapeHtml(job.job_id)}"
        data-job-name="${escapeHtml(job.step_name)}"
      >
        Advance Timeout
      </button>
    `;
  }

  return `
    <div class="muted small-note">
      Action unavailable: ${renderValue(job.operator_actions.advance_timeout_reason)}
    </div>
  `;
}

function renderAttempts(job: RunJobView): string {
  if (job.attempts.length === 0) {
    return `<div class="empty-state small-empty">No attempts recorded.</div>`;
  }

  return `
    <table class="data-table nested-table">
      <thead>
        <tr>
          <th>Attempt</th>
          <th>Status</th>
          <th>Started</th>
          <th>Completed</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${job.attempts
          .map(
            (attempt) => `
              <tr>
                <td>${renderValue(attempt.attempt)}</td>
                <td><span class="${statusClass(attempt.status)}">${renderValue(attempt.status)}</span></td>
                <td>${renderValue(attempt.started_at)}</td>
                <td>${renderValue(attempt.completed_at)}</td>
                <td>${renderValue(attempt.error_message)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderToolbar(args: {
  selectedTenant: string;
  selectedService: string;
  autoRefresh: boolean;
  tenants: string[];
  services: string[];
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="toolbar">
        <div class="toolbar-group">
          <label>
            <span class="toolbar-label">Tenant</span>
            <select id="tenant-filter">
              <option value="">All</option>
              ${args.tenants
                .map(
                  (tenant) => `
                    <option value="${escapeHtml(tenant)}" ${tenant === args.selectedTenant ? "selected" : ""}>
                      ${escapeHtml(tenant)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>

          <label>
            <span class="toolbar-label">Service</span>
            <select id="service-filter">
              <option value="">All</option>
              ${args.services
                .map(
                  (service) => `
                    <option value="${escapeHtml(service)}" ${service === args.selectedService ? "selected" : ""}>
                      ${escapeHtml(service)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
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

export function renderRunsList(runs: RunSummary[]): string {
  if (runs.length === 0) {
    return `
      <section class="panel">
        <div class="empty-state">
          <h2>No runs match the current filters.</h2>
          <p class="muted">Try clearing tenant/service filters or trigger a new workflow run.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Recent Runs</h2>
        <p class="muted">Internal ops view across all tenants and workflows.</p>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Tenant</th>
            <th>Service</th>
            <th>Env</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Step</th>
            <th>Job</th>
            <th>Attempt</th>
            <th>Failure</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          ${runs
            .map(
              (run) => `
                <tr>
                  <td>
                    <a href="#run/${encodeURIComponent(run.run_id)}">${escapeHtml(run.run_id)}</a>
                  </td>
                  <td>${renderValue(run.tenant_id)}</td>
                  <td>${renderValue(run.service_name)}</td>
                  <td>${renderValue(run.environment_name)}</td>
                  <td>${renderValue(run.provider)}</td>
                  <td><span class="${statusClass(run.status)}">${renderValue(run.status)}</span></td>
                  <td>${renderValue(run.current_step)}</td>
                  <td>${renderValue(run.logical_job_type)}</td>
                  <td>${renderValue(run.active_attempt)}</td>
                  <td>${renderValue(run.latest_failure_kind)}</td>
                  <td>${renderValue(run.updated_at)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

export function renderRunDetail(detail: RunDetail, apiBaseUrl: string): string {
  return `
    <section class="panel">
      <div class="detail-header">
        <div>
          <a class="back-link" href="#">← Back to runs</a>
          <h2>${escapeHtml(detail.run_id)}</h2>
          <p class="muted">${escapeHtml(detail.service_name)} · ${escapeHtml(detail.environment_name)} · ${escapeHtml(detail.tenant_id)}</p>
        </div>
        <div class="detail-header-right">
          <span class="${statusClass(detail.status)}">${escapeHtml(detail.status)}</span>
          <a class="trace-link" href="${escapeHtml(apiBaseUrl + detail.trace_path)}" target="_blank" rel="noreferrer">Open trace</a>
        </div>
      </div>

      <div class="summary-grid">
        <div><strong>Project</strong><span>${renderValue(detail.project_id)}</span></div>
        <div><strong>Provider</strong><span>${renderValue(detail.provider)}</span></div>
        <div><strong>Current step</strong><span>${renderValue(detail.current_step)}</span></div>
        <div><strong>Logical job type</strong><span>${renderValue(detail.logical_job_type)}</span></div>
        <div><strong>Logical job status</strong><span>${renderValue(detail.logical_job_status)}</span></div>
        <div><strong>Active attempt</strong><span>${renderValue(detail.active_attempt)}</span></div>
        <div><strong>Failure kind</strong><span>${renderValue(detail.latest_failure_kind)}</span></div>
        <div><strong>Branch</strong><span>${renderValue(detail.branch)}</span></div>
        <div><strong>Repo</strong><span>${renderValue(detail.repo_url)}</span></div>
        <div><strong>Created</strong><span>${renderValue(detail.created_at)}</span></div>
        <div><strong>Updated</strong><span>${renderValue(detail.updated_at)}</span></div>
        <div><strong>Completed</strong><span>${renderValue(detail.completed_at)}</span></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Steps</h3>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Status</th>
            <th>Started</th>
            <th>Completed</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${detail.steps
            .map(
              (step) => `
                <tr>
                  <td>${renderValue(step.step)}</td>
                  <td><span class="${statusClass(step.status)}">${renderValue(step.status)}</span></td>
                  <td>${renderValue(step.started_at)}</td>
                  <td>${renderValue(step.completed_at)}</td>
                  <td>${renderValue(step.error_message)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Jobs</h3>
      </div>
      <div class="job-list">
        ${detail.jobs
          .map(
            (job) => `
              <article class="job-card">
                <div class="job-card-header">
                  <div>
                    <h4>${escapeHtml(job.step_name)} · ${escapeHtml(job.job_type)}</h4>
                    <p class="muted">${escapeHtml(job.job_id)}</p>
                  </div>
                  <span class="${statusClass(job.status)}">${renderValue(job.status)}</span>
                </div>

                <div class="summary-grid compact-grid">
                  <div><strong>Provider</strong><span>${renderValue(job.provider)}</span></div>
                  <div><strong>Active attempt</strong><span>${renderValue(job.active_attempt)}</span></div>
                  <div><strong>Attempt count</strong><span>${renderValue(job.attempt_count)}</span></div>
                  <div><strong>Max attempts</strong><span>${renderValue(job.max_attempts)}</span></div>
                  <div><strong>Terminal attempt</strong><span>${renderValue(job.terminal_attempt_no)}</span></div>
                  <div><strong>Next retry</strong><span>${renderValue(job.next_retry_at)}</span></div>
                </div>

                <div class="job-actions">
                  <strong>Operator action</strong>
                  <div class="job-actions-row">
                    ${renderAdvanceTimeoutControl(job)}
                  </div>
                </div>

                <div class="job-error-block">
                  <strong>Job error</strong>
                  <pre>${escapeHtml(job.error_message ?? "—")}</pre>
                </div>

                ${renderAttempts(job)}
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Latest Failure</h3>
      </div>
      ${
        detail.failure
          ? `
            <div class="failure-block">
              <div class="summary-grid compact-grid">
                <div><strong>Step</strong><span>${renderValue(detail.failure.step)}</span></div>
                <div><strong>Logical job type</strong><span>${renderValue(detail.failure.logical_job_type)}</span></div>
                <div><strong>Attempt</strong><span>${renderValue(detail.failure.attempt)}</span></div>
                <div><strong>Failure kind</strong><span>${renderValue(detail.failure.failure_kind)}</span></div>
              </div>
              <div class="job-error-block">
                <strong>Failure message</strong>
                <pre>${escapeHtml(detail.failure.failure_message ?? "—")}</pre>
              </div>
              <div class="job-error-block">
                <strong>Failure payload</strong>
                <pre>${escapeHtml(JSON.stringify(detail.failure.failure_payload, null, 2))}</pre>
              </div>
            </div>
          `
          : `<div class="empty-state small-empty">No failure information for this run.</div>`
      }
    </section>
  `;
}
