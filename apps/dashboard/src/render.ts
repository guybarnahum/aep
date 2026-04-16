// --- Safe helpers for employee rendering ---
function getEmployeeDisplayState(employee: OperatorEmployeeRecord): string {
  if (
    employee.runtime.runtimeStatus === "implemented" &&
    employee.runtime.effectiveState?.state
  ) {
    return employee.runtime.effectiveState.state;
  }
  return employee.runtime.runtimeStatus;
}

function isEmployeeBlocked(employee: OperatorEmployeeRecord): boolean {
  return employee.runtime.effectiveState?.blocked === true;
}

function isEmployeeRestricted(employee: OperatorEmployeeRecord): boolean {
  return employee.runtime.effectiveState?.state === "restricted";
}

function getEmployeeBudgetSummary(employee: OperatorEmployeeRecord): string {
  const maxActionsPerHour = employee.runtime.effectiveBudget?.maxActionsPerHour;
  return typeof maxActionsPerHour === "number" ? `${maxActionsPerHour}/hr` : "—";
}

function getEmployeeGovernanceSummary(employee: OperatorEmployeeRecord): string {
  if (employee.runtime.runtimeStatus === "planned") {
    return "Planned employee — not yet implemented in runtime.";
  }
  if (employee.runtime.runtimeStatus === "disabled") {
    return "Disabled employee boundary.";
  }
  return employee.hasCognitiveProfile
    ? "Cognitive profile present"
    : "No cognitive profile yet";
}
// 1. New Persona-driven Employee Card
function renderEmployeeCard(employee: OperatorEmployeeRecord, selectedEmployeeId: string | null): string {
  const iden = employee.identity;
  const profile = employee.publicProfile;
  const isSelected = selectedEmployeeId === iden.employeeId;
  const displayName = profile?.displayName ?? iden.employeeId;
  const skills = profile?.skills?.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("") || "";

  return `
    <article class="service-card persona-card ${isSelected ? "service-card-selected" : ""}">
      <div class="service-card-header">
        <div class="avatar-block">
          ${profile?.avatarUrl ? `<img src="${escapeHtml(profile.avatarUrl)}" class="avatar-img" />` : `<div class="avatar-fallback">${escapeHtml(displayName?.[0] || "?")}</div>`}
        </div>
        <div style="flex: 1; margin-left: 12px;">
          <h3 style="margin:0">${escapeHtml(displayName)}</h3>
          <p class="muted small" style="margin:0">${escapeHtml(iden.roleId)} · ${escapeHtml(iden.teamId)}</p>
        </div>
        <div class="card-actions">
          <span class="${statusClass(employee.runtime.effectiveState?.state ?? employee.runtime.runtimeStatus)}">${escapeHtml(getEmployeeDisplayState(employee))}</span>
        </div>
      </div>

      <div class="persona-body">
        <p class="persona-bio"><em>"${escapeHtml(profile?.bio || "No bio set.")}"</em></p>
        <div class="skills-row">${skills}</div>
      </div>

      <div class="governance-grid" style="border-top: 1px solid var(--border); padding-top: 12px;">
        <div class="muted small">Runtime: ${escapeHtml(employee.runtime.runtimeStatus)}</div>
        <div class="muted small">Budget: ${escapeHtml(getEmployeeBudgetSummary(employee))}</div>
        <div class="muted small">Cognitive profile: ${employee.hasCognitiveProfile ? "present" : "absent"}</div>
        <div class="muted small">${escapeHtml(getEmployeeGovernanceSummary(employee))}</div>
      </div>
    </article>
  `;
}

// 2. Add Monologue to Manager Log Table
// Update the row generation inside renderManagerLogTable:
// Find the <td> for "Reason" and update its content:
//
// `<td>
//   <div>${escapeHtml(entry.reason)}</div>
//   <div class="muted small">${escapeHtml(entry.message)}</div>
//   ${entry.executionContext?.internalMonologue ? 
//     renderExpandableText(`thought-${entry.timestamp}`, "🧠 View Internal Monologue", entry.executionContext.internalMonologue) : ""}
//   ...
// </td>`

// 3. New Roadmap Section
function renderRoadmapsTable(roadmaps: TeamRoadmap[]): string {
  if (roadmaps.length === 0) return `<div class="empty-state">No strategic objectives defined.</div>`;
  return `
    <table class="data-table">
      <thead><tr><th>Priority</th><th>Objective</th><th>Context</th><th>Status</th></tr></thead>
      <tbody>
        ${roadmaps.map(r => `
          <tr>
            <td><span class="priority-pill p-${r.priority}">${r.priority}</span></td>
            <td><strong>${escapeHtml(r.objective_title)}</strong></td>
            <td class="muted small">${escapeHtml(r.strategic_context)}</td>
            <td><span class="status status-${r.status}">${r.status}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
import type {
  ApprovalActionFilter,
  ApprovalRecord,
  ApprovalStatusFilter,
  CausalityLink,
  ControlHistoryRecord,
  DecisionSeverityFilter,
  EmployeeContinuityOverview,
  EmployeeControlOverview,
  EmployeeEffectivePolicyOverview,
  EmployeeMessageRecord,
  DepartmentFilters,
  DepartmentOverview,
  EmployeeRuntimeStatusFilter,
  EscalationRecord,
  EscalationStateFilter,
  ExternalMirrorOverview,
  ManagerDecisionRecord,
  MessageThreadDetail,
  MessageThreadRecord,
  MirrorThreadOverview,
  NarrativeTimeline,
  NarrativeTimelineItem,
  OperatorEmployeeRecord,
  OrgPresenceOverview,
  TaskArtifactRecord,
  TaskDependency,
  TaskDetail,
  TaskRecord,
  ThreadVisibilitySummary,
  TaskVisibilitySummary,
  TaskStatus,
  WorkOverview,
  RunSummary,
  ServiceOverview,
  TenantOverview,
  TenantSummary,
  TeamRoadmap,
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
    case "implemented":
      return "status status-completed";
    case "planned":
      return "status status-waiting";
    case "disabled":
      return "status status-failed";
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
    case "queued":
      return "status status-open";
    case "blocked":
      return "status status-failed";
    case "ready":
      return "status status-waiting";
    case "in_progress":
      return "status status-running";
    case "escalated":
      return "status status-restricted";
    case "pass":
      return "status status-completed";
    case "fail":
      return "status status-failed";
    case "remediate":
      return "status status-restricted";
    case "manual_escalation":
      return "status status-open";
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

function renderCompactPill(label: string, value: string | number): string {
  return `<span class="compact-pill"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`;
}

function renderCompactHtmlPill(label: string, htmlValue: string): string {
  return `<span class="compact-pill"><strong>${escapeHtml(label)}:</strong> ${htmlValue}</span>`;
}

function describeArtifactKind(artifact: TaskArtifactRecord): string {
  const kind = artifact.content?.kind;
  return typeof kind === "string" ? kind : artifact.artifactType;
}

function statusRank(status: TaskStatus): number {
  switch (status) {
    case "in_progress":
      return 0;
    case "ready":
      return 1;
    case "blocked":
      return 3;
    case "escalated":
      return 4;
    case "failed":
      return 5;
    case "completed":
      return 6;
  }
}

function threadKind(thread: MessageThreadRecord): string {
  if (thread.relatedApprovalId) return "approval";
  if (thread.relatedEscalationId) return "escalation";
  if (thread.relatedTaskId) return "task";
  return "coordination";
}

function renderCausalityLinks(links: CausalityLink[]): string {
  if (links.length === 0) {
    return `<div class="empty-state small-empty">No explicit causal links recorded.</div>`;
  }

  return `
    <div class="causality-link-list">
      ${links
        .map(
          (link) => `
            <a class="causality-link-item" href="${escapeHtml(link.href)}">
              <span class="causality-link-kind">${escapeHtml(link.kind)}</span>
              <strong>${escapeHtml(link.label)}</strong>
              <span class="muted small">${escapeHtml(link.id)}</span>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function buildTaskCausalityLinks(detail: TaskDetail): CausalityLink[] {
  const links: CausalityLink[] = [];

  if (detail.task.sourceThreadId) {
    links.push({
      kind: "source_thread",
      id: detail.task.sourceThreadId,
      label: "Created from thread",
      href: `#thread/${encodeURIComponent(detail.task.sourceThreadId)}`,
    });
  }

  if (detail.task.sourceMessageId) {
    links.push({
      kind: "source_message",
      id: detail.task.sourceMessageId,
      label: "Triggered by message",
      href: "#work",
    });
  }

  if (detail.task.sourceApprovalId) {
    links.push({
      kind: "source_approval",
      id: detail.task.sourceApprovalId,
      label: "Originated from approval",
      href: "#department",
    });
  }

  if (detail.task.sourceEscalationId) {
    links.push({
      kind: "source_escalation",
      id: detail.task.sourceEscalationId,
      label: "Originated from escalation",
      href: "#department",
    });
  }

  for (const thread of detail.relatedThreads) {
    if (thread.relatedApprovalId) {
      links.push({
        kind: "approval_thread",
        id: thread.id,
        label: thread.topic,
        href: `#thread/${encodeURIComponent(thread.id)}`,
      });
      continue;
    }

    if (thread.relatedEscalationId) {
      links.push({
        kind: "escalation_thread",
        id: thread.id,
        label: thread.topic,
        href: `#thread/${encodeURIComponent(thread.id)}`,
      });
      continue;
    }

    links.push({
      kind: "related_thread",
      id: thread.id,
      label: thread.topic,
      href: `#thread/${encodeURIComponent(thread.id)}`,
    });
  }

  return links;
}

function buildThreadCausalityLinks(detail: MessageThreadDetail): CausalityLink[] {
  const links: CausalityLink[] = [];

  if (detail.thread.relatedTaskId) {
    links.push({
      kind: "source_thread",
      id: detail.thread.relatedTaskId,
      label: "Linked task",
      href: `#task/${encodeURIComponent(detail.thread.relatedTaskId)}`,
    });
  }

  if (detail.thread.relatedApprovalId) {
    links.push({
      kind: "source_approval",
      id: detail.thread.relatedApprovalId,
      label: "Linked approval",
      href: "#department",
    });
  }

  if (detail.thread.relatedEscalationId) {
    links.push({
      kind: "source_escalation",
      id: detail.thread.relatedEscalationId,
      label: "Linked escalation",
      href: "#department",
    });
  }

  return links;
}

function inferNarrativeCausalityLinks(item: NarrativeTimelineItem): CausalityLink[] {
  const links: CausalityLink[] = [];

  if (item.taskId && item.threadId) {
    links.push({
      kind: "related_thread",
      id: item.threadId,
      label: "Primary related thread",
      href: `#thread/${encodeURIComponent(item.threadId)}`,
    });
  }

  if (item.approvalId && item.threadId) {
    links.push({
      kind: "approval_thread",
      id: item.threadId,
      label: "Approval thread",
      href: `#thread/${encodeURIComponent(item.threadId)}`,
    });
  }

  if (item.escalationId && item.threadId) {
    links.push({
      kind: "escalation_thread",
      id: item.threadId,
      label: "Escalation thread",
      href: `#thread/${encodeURIComponent(item.threadId)}`,
    });
  }

  return links;
}

function synthesizeCausalityExplanation(
  item: NarrativeTimelineItem,
  links: CausalityLink[],
): string | null {
  if (links.length === 0) {
    return null;
  }

  const approvalLink = links.find((l) => l.kind === "approval_thread");
  const escalationLink = links.find((l) => l.kind === "escalation_thread");
  const threadLink = links.find((l) => l.kind === "related_thread");

  if (item.taskId && escalationLink) {
    return `This task exists because escalation ${escalationLink.id} triggered follow-up work.`;
  }

  if (item.taskId && approvalLink) {
    return `This task exists because approval ${approvalLink.id} resulted in follow-up execution.`;
  }

  if (item.taskId && threadLink) {
    return `This task was created from discussion in thread ${threadLink.id}.`;
  }

  if (item.approvalId && threadLink) {
    return `This approval was discussed and resolved in thread ${threadLink.id}.`;
  }

  if (item.escalationId && threadLink) {
    return `This escalation originated and progressed in thread ${threadLink.id}.`;
  }

  return null;
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
  liveSurfaceLabel?: string | null;
  liveSurfaceEnabled?: boolean;
  lastRefreshedLabel?: string | null;
  lastAutoRefreshLabel?: string | null;
  isRefreshing?: boolean;
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="toolbar-copy-stack">
            <p class="muted">
              Canonical view of company work, governance, and external collaboration.
            </p>
            ${
              args.liveSurfaceEnabled && args.liveSurfaceLabel
                ? `
                  <div class="live-status-row">
                    <span class="live-pill">Live surface</span>
                    <span class="refresh-indicator ${args.isRefreshing ? "" : "refresh-indicator-hidden"}" data-refresh-indicator>Refreshing…</span>
                    <span class="muted small">${escapeHtml(args.liveSurfaceLabel)}</span>
                    ${
                      args.lastRefreshedLabel
                        ? `<span class="muted small">Refreshed ${escapeHtml(args.lastRefreshedLabel)}</span>`
                        : ""
                    }
                    ${
                      args.autoRefresh && args.lastAutoRefreshLabel
                        ? `<span class="muted small">Auto-refresh tick ${escapeHtml(args.lastAutoRefreshLabel)}</span>`
                        : ""
                    }
                  </div>
                `
                : `
                  <div class="live-status-row">
                    <span class="refresh-indicator ${args.isRefreshing ? "" : "refresh-indicator-hidden"}" data-refresh-indicator>Refreshing…</span>
                    ${
                      args.lastRefreshedLabel
                        ? `<span class="muted small">Refreshed ${escapeHtml(args.lastRefreshedLabel)}</span>`
                        : ""
                    }
                  </div>
                `
            }
          </div>
          ${args.mutationStatus ? `<p class="mutation-status">${escapeHtml(args.mutationStatus)}</p>` : ""}
        </div>

        <div class="toolbar-group toolbar-actions">
          <label class="checkbox-label">
            <input id="auto-refresh-toggle" type="checkbox" ${args.autoRefresh ? "checked" : ""} />
            <span>Auto-refresh while visible (15s)</span>
          </label>
          <button id="refresh-button" class="button" type="button">Refresh</button>
        </div>
      </div>
    </section>
  `;
}

export function renderPrimaryNav(args: {
  activeView: "tenant" | "department" | "work" | "company" | "mirrors" | "activity";
  tenantHref: string;
}): string {
  return `
    <section class="panel toolbar-panel">
      <div class="view-nav">
        <a class="view-nav-link ${args.activeView === "tenant" ? "view-nav-link-active" : ""}" href="${escapeHtml(args.tenantHref)}">
          Tenants
        </a>
        <a class="view-nav-link ${args.activeView === "work" ? "view-nav-link-active" : ""}" href="#work">
          Work
        </a>
        <a class="view-nav-link ${args.activeView === "activity" ? "view-nav-link-active" : ""}" href="#activity">
          Activity
        </a>
        <a class="view-nav-link ${args.activeView === "company" ? "view-nav-link-active" : ""}" href="#company">
          Company
        </a>
        <a class="view-nav-link ${args.activeView === "mirrors" ? "view-nav-link-active" : ""}" href="#mirrors">
          Mirrors
        </a>
        <a class="view-nav-link ${args.activeView === "department" ? "view-nav-link-active" : ""}" href="#department">
          Governance
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
                    ${escapeHtml(employee.publicProfile?.displayName ?? employee.identity.employeeId)} (${escapeHtml(employee.identity.employeeId)})
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
          <span>Employee runtime status</span>
          <select id="employee-runtime-status-filter">
            ${(
              [
                "all",
                "implemented",
                "planned",
                "disabled",
              ] as EmployeeRuntimeStatusFilter[]
            )
              .map(
                (value) => `
                  <option value="${value}" ${args.filters.runtimeStatus === value ? "selected" : ""}>
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

function renderTaskVisibilitySummary(summary: TaskVisibilitySummary): string {
  return `
    <div class="meta-grid">
      ${renderCompactPill("Plan", summary.hasPlanArtifact ? "yes" : "no")}
      ${renderCompactPill("Rationale", summary.hasPublicRationaleArtifact ? "yes" : "no")}
      ${renderCompactPill("Validation", summary.latestValidationStatus ?? "—")}
      ${renderCompactPill("Decision", summary.latestDecisionVerdict ?? "—")}
      ${renderCompactPill("Threads", summary.relatedThreadCount)}
      ${renderCompactPill("Approval threads", summary.relatedApprovalThreadCount)}
      ${renderCompactPill("Escalation threads", summary.relatedEscalationThreadCount)}
    </div>
  `;
}

function renderThreadVisibility(summary: ThreadVisibilitySummary): string {
  return `
    <div class="meta-grid">
      ${renderCompactPill("Messages", summary.messageCount)}
      ${renderCompactPill("Rationale publication", summary.hasPublicRationalePublication ? "yes" : "no")}
      ${renderCompactPill("Presentation style", summary.latestPublicRationalePresentationStyle ?? "—")}
      ${renderCompactPill("Approval actions", summary.approvalActionCount)}
      ${renderCompactPill("Escalation actions", summary.escalationActionCount)}
      ${renderCompactPill("External projections", summary.externalProjectionCount)}
      ${renderCompactPill("Inbound replies", typeof summary.inboundRepliesAllowed === "boolean" ? String(summary.inboundRepliesAllowed) : "—")}
      ${renderCompactPill("External actions", typeof summary.externalActionsAllowed === "boolean" ? String(summary.externalActionsAllowed) : "—")}
    </div>
  `;
}

function renderTaskCard(task: TaskRecord): string {
  return `
    <article class="work-card">
      <div class="work-card-top">
        <div>
          <h3><a href="#task/${encodeURIComponent(task.id)}">${escapeHtml(task.title)}</a></h3>
          <div class="muted small">${escapeHtml(task.taskType)} · ${escapeHtml(task.id)}</div>
        </div>
        <span class="${statusClass(task.status)}">${escapeHtml(task.status)}</span>
      </div>
      <div class="meta-grid">
        ${renderCompactPill("Assigned team", task.assignedTeamId)}
        ${renderCompactPill("Assigned employee", task.assignedEmployeeId ?? "—")}
        ${renderCompactPill("Originating team", task.originatingTeamId)}
        ${renderCompactPill("Blocking deps", task.blockingDependencyCount)}
      </div>
    </article>
  `;
}

function renderThreadCard(thread: MessageThreadRecord): string {
  return `
    <article class="work-card">
      <div class="work-card-top">
        <div>
          <h3><a href="#thread/${encodeURIComponent(thread.id)}">${escapeHtml(thread.topic)}</a></h3>
          <div class="muted small">${escapeHtml(thread.id)}</div>
        </div>
        <span class="status">${escapeHtml(threadKind(thread))}</span>
      </div>
      <div class="meta-grid">
        ${renderCompactPill("Visibility", thread.visibility)}
        ${renderCompactPill("Task", thread.relatedTaskId ?? "—")}
        ${renderCompactPill("Approval", thread.relatedApprovalId ?? "—")}
        ${renderCompactPill("Escalation", thread.relatedEscalationId ?? "—")}
      </div>
    </article>
  `;
}

function renderArtifactsTable(artifacts: TaskArtifactRecord[]): string {
  if (artifacts.length === 0) {
    return `<div class="empty-state small-empty">No artifacts recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Kind</th>
          <th>Summary</th>
          <th>Created by</th>
          <th>Content</th>
        </tr>
      </thead>
      <tbody>
        ${artifacts.map((artifact) => `
          <tr>
            <td><span class="${statusClass(artifact.artifactType === "result" ? "completed" : artifact.artifactType === "plan" ? "waiting" : "open")}">${escapeHtml(artifact.artifactType)}</span></td>
            <td>${escapeHtml(describeArtifactKind(artifact))}</td>
            <td>${escapeHtml(artifact.summary ?? "—")}</td>
            <td>${escapeHtml(artifact.createdByEmployeeId ?? "—")}</td>
            <td>${renderExpandableText(`artifact-${artifact.id}`, "Content", formatJsonBlock(artifact.content))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDependenciesTable(dependencies: TaskDependency[]): string {
  if (dependencies.length === 0) {
    return `<div class="empty-state small-empty">No dependencies.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Depends on</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        ${dependencies.map((dependency) => `
          <tr>
            <td><a href="#task/${encodeURIComponent(dependency.taskId)}">${escapeHtml(dependency.taskId)}</a></td>
            <td><a href="#task/${encodeURIComponent(dependency.dependsOnTaskId)}">${escapeHtml(dependency.dependsOnTaskId)}</a></td>
            <td>${escapeHtml(dependency.dependencyType)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderMessages(messages: EmployeeMessageRecord[]): string {
  if (messages.length === 0) {
    return `<div class="empty-state small-empty">No messages in this thread.</div>`;
  }

  return `
    <div class="message-list">
      ${messages.map((message) => `
        <article class="message-card">
          <div class="message-card-top">
            <div>
              <strong>${escapeHtml(message.senderEmployeeId)}</strong>
              <span class="muted small"> → ${escapeHtml(message.receiverEmployeeId ?? message.receiverTeamId ?? "—")}</span>
            </div>
            <div class="message-meta-right">
              <span class="${statusClass(message.status)}">${escapeHtml(message.status)}</span>
              <span class="muted small">${escapeHtml(message.source)}</span>
            </div>
          </div>
          ${message.subject ? `<div class="message-subject">${escapeHtml(message.subject)}</div>` : ""}
          <div class="message-body">${escapeHtml(message.body)}</div>
          <div class="meta-grid">
            ${renderCompactPill("Type", message.type)}
            ${renderCompactPill("Created", message.createdAt ?? "—")}
            ${renderCompactPill("Task", message.relatedTaskId ?? "—")}
            ${renderCompactPill("Approval", message.relatedApprovalId ?? "—")}
            ${renderCompactPill("Escalation", message.relatedEscalationId ?? "—")}
          </div>
          ${message.payload && Object.keys(message.payload).length > 0
            ? renderExpandableText(`msg-payload-${message.id}`, "Payload", formatJsonBlock(message.payload))
            : ""}
          ${(message.mirrorDeliveries?.length ?? 0) > 0
            ? renderExpandableText(`msg-deliveries-${message.id}`, "Mirror deliveries", formatJsonBlock(message.mirrorDeliveries))
            : ""}
          ${(message.externalMessageProjections?.length ?? 0) > 0
            ? renderExpandableText(`msg-projections-${message.id}`, "External message projections", formatJsonBlock(message.externalMessageProjections))
            : ""}
        </article>
      `).join("")}
    </div>
  `;
}

export function renderWorkOverview(overview: WorkOverview): string {
  const sortedTasks = [...overview.tasks].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });

  const sortedThreads = [...overview.threads].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Canonical work</h2>
        <p class="muted">
          Tasks and threads rendered directly from AEP-native work surfaces.
          This surface is suitable for periodic live refresh.
        </p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Tasks", sortedTasks.length, `${sortedTasks.filter((task) => task.status === "in_progress").length} in progress`)}
        ${renderSummaryCard("Ready", sortedTasks.filter((task) => task.status === "ready").length, "ready to execute")}
        ${renderSummaryCard("Blocked", sortedTasks.filter((task) => task.status === "blocked").length, "waiting on dependencies")}
        ${renderSummaryCard("Threads", sortedThreads.length, `${sortedThreads.filter((thread) => thread.relatedTaskId).length} task-linked`)}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Tasks</h2>
        <p class="muted">${sortedTasks.length} canonical tasks</p>
      </div>
      <div class="work-grid">
        ${sortedTasks.map(renderTaskCard).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Threads</h2>
        <p class="muted">${sortedThreads.length} canonical threads</p>
      </div>
      <div class="work-grid">
        ${sortedThreads.map(renderThreadCard).join("")}
      </div>
    </section>
  `;
}

function getEmployeeDisplayName(employee: OperatorEmployeeRecord): string {
  return employee.publicProfile?.displayName ?? employee.identity.employeeId;
}

function employeeTouchesTask(task: TaskRecord, employeeId: string): boolean {
  return (
    task.assignedEmployeeId === employeeId ||
    task.ownerEmployeeId === employeeId ||
    task.createdByEmployeeId === employeeId
  );
}

function employeeTouchesThread(
  thread: MessageThreadRecord,
  employeeId: string,
): boolean {
  return thread.createdByEmployeeId === employeeId;
}

function teamTouchesTask(task: TaskRecord, teamId: string): boolean {
  return task.assignedTeamId === teamId || task.originatingTeamId === teamId;
}

function teamTouchesThread(
  thread: MessageThreadRecord,
  teamId: string,
  tasksById: Map<string, TaskRecord>,
): boolean {
  if (thread.relatedTaskId) {
    const task = tasksById.get(thread.relatedTaskId);
    if (task) {
      return teamTouchesTask(task, teamId);
    }
  }
  return false;
}

function uniqueTeamIds(overview: OrgPresenceOverview): string[] {
  return [...new Set(overview.employees.map((employee) => employee.identity.teamId))].sort();
}

function renderProfileHeader(employee: OperatorEmployeeRecord): string {
  const profile = employee.publicProfile;
  const displayName = getEmployeeDisplayName(employee);
  const skills = profile?.skills?.map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join("") ?? "";

  return `
    <section class="panel">
      <div class="profile-header">
        <div class="avatar-block profile-avatar-block">
          ${profile?.avatarUrl
            ? `<img src="${escapeHtml(profile.avatarUrl)}" class="avatar-img" />`
            : `<div class="avatar-fallback">${escapeHtml(displayName[0] ?? "?")}</div>`}
        </div>
        <div class="profile-main">
          <h2>${escapeHtml(displayName)}</h2>
          <p class="muted">${escapeHtml(employee.identity.roleId)} · ${escapeHtml(employee.identity.teamId)} · ${escapeHtml(employee.identity.employeeId)}</p>
          <p class="profile-bio">${escapeHtml(profile?.bio ?? "No bio set.")}</p>
          <div class="skills-row">${skills}</div>
        </div>
        <div class="profile-status-block">
          <span class="${statusClass(employee.runtime.effectiveState?.state ?? employee.runtime.runtimeStatus)}">${escapeHtml(getEmployeeDisplayState(employee))}</span>
          <div class="muted small">Budget: ${escapeHtml(getEmployeeBudgetSummary(employee))}</div>
          <div class="muted small">${escapeHtml(getEmployeeGovernanceSummary(employee))}</div>
        </div>
      </div>
    </section>
  `;
}

function renderEmployeeGovernancePanel(
  controlOverview: EmployeeControlOverview,
  effectivePolicy: EmployeeEffectivePolicyOverview,
): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h3>Governance and steering</h3>
        <p class="muted">
          Current control state and effective runtime policy for this employee.
        </p>
      </div>

      <div class="summary-grid">
        ${renderSummaryCard("Control state", controlOverview.effectiveState.state, controlOverview.effectiveState.blocked ? "blocked" : "not blocked")}
        ${renderSummaryCard("Implemented", effectivePolicy.implemented ? "yes" : "no", effectivePolicy.status)}
        ${renderSummaryCard("Allowed tenants", effectivePolicy.allowedTenants?.length ?? effectivePolicy.effectiveAuthority?.allowedTenants?.length ?? 0, "effective scope")}
        ${renderSummaryCard("Allowed services", effectivePolicy.allowedServices?.length ?? effectivePolicy.effectiveAuthority?.allowedServices?.length ?? 0, "effective scope")}
      </div>

      <div class="meta-grid">
        ${renderCompactPill("Employee", effectivePolicy.employeeId)}
        ${renderCompactPill("Company", effectivePolicy.companyId)}
        ${renderCompactPill("Team", effectivePolicy.teamId)}
        ${renderCompactPill("Blocked", String(controlOverview.effectiveState.blocked))}
      </div>

      ${controlOverview.control
        ? renderExpandableText(
            `employee-control-${effectivePolicy.employeeId}`,
            "Stored control record",
            formatJsonBlock(controlOverview.control),
          )
        : `<div class="empty-state small-empty">No stored override record.</div>`}

      ${effectivePolicy.effectiveAuthority
        ? renderExpandableText(
            `employee-effective-authority-${effectivePolicy.employeeId}`,
            "Effective authority",
            formatJsonBlock(effectivePolicy.effectiveAuthority),
          )
        : ""}

      ${effectivePolicy.effectiveBudget
        ? renderExpandableText(
            `employee-effective-budget-${effectivePolicy.employeeId}`,
            "Effective budget",
            formatJsonBlock(effectivePolicy.effectiveBudget),
          )
        : ""}

      ${effectivePolicy.message
        ? `<p class="muted small">${escapeHtml(effectivePolicy.message)}</p>`
        : ""}
    </section>
  `;
}

function renderEmployeeTaskContinuityList(tasks: TaskRecord[]): string {
  if (tasks.length === 0) {
    return `<div class="empty-state small-empty">No canonical task continuity recorded yet.</div>`;
  }

  return `
    <div class="mini-list">
      ${tasks
        .map(
          (task) => `
            <a class="mini-list-item" href="#task/${encodeURIComponent(task.id)}">
              <div>
                <strong>${escapeHtml(task.title)}</strong>
                <div class="muted small">${escapeHtml(task.taskType)} · ${escapeHtml(task.id)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="${statusClass(task.status)}">${escapeHtml(task.status)}</span>
                ${renderCompactHtmlPill("Updated", formatTimestamp(task.updatedAt ?? task.createdAt))}
              </div>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmployeeThreadContinuityList(threads: MessageThreadRecord[]): string {
  if (threads.length === 0) {
    return `<div class="empty-state small-empty">No active canonical threads yet.</div>`;
  }

  return `
    <div class="mini-list">
      ${threads
        .map(
          (thread) => `
            <a class="mini-list-item" href="#thread/${encodeURIComponent(thread.id)}">
              <div>
                <strong>${escapeHtml(thread.topic)}</strong>
                <div class="muted small">${escapeHtml(thread.id)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="status">${escapeHtml(threadKind(thread))}</span>
                ${renderCompactHtmlPill("Updated", formatTimestamp(thread.updatedAt ?? thread.createdAt))}
              </div>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmployeeDecisionContinuityList(
  entries: ManagerDecisionRecord[],
): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No recent manager decisions affecting this employee.</div>`;
  }

  return `
    <div class="mini-list">
      ${entries
        .map(
          (entry) => `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(entry.recommendation)}</strong>
                <div class="muted small">${escapeHtml(entry.reason)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="${statusClass(entry.severity)}">${escapeHtml(entry.severity)}</span>
                ${renderCompactHtmlPill("Time", formatTimestamp(entry.timestamp))}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmployeeControlContinuityList(
  entries: ControlHistoryRecord[],
): string {
  if (entries.length === 0) {
    return `<div class="empty-state small-empty">No recent control history affecting this employee.</div>`;
  }

  return `
    <div class="mini-list">
      ${entries
        .map(
          (entry) => `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(entry.transition)}</strong>
                <div class="muted small">${escapeHtml(entry.reason)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="${statusClass(entry.nextState)}">${escapeHtml(entry.nextState)}</span>
                ${renderCompactHtmlPill("Time", formatTimestamp(entry.timestamp))}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmployeeContinuityPanel(
  continuity: EmployeeContinuityOverview,
): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h3>Identity continuity</h3>
        <p class="muted">
          Recent canonical work and governance context for this employee.
          This view is intended to feel live as task, thread, and governance state changes.
        </p>
      </div>

      <div class="summary-grid">
        ${renderSummaryCard("Working now", continuity.activeTasks.length, "active canonical tasks")}
        ${renderSummaryCard("Recent tasks", continuity.recentTasks.length, "most recent owned, assigned, or created tasks")}
        ${renderSummaryCard("Active threads", continuity.activeThreads.length, "recent thread activity attributed to this employee")}
        ${renderSummaryCard(
          "Governance events",
          continuity.recentManagerDecisions.length + continuity.recentControlHistory.length,
          "recent decisions and control history",
        )}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Working now</h3></div>
      ${renderEmployeeTaskContinuityList(continuity.activeTasks)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Recent tasks</h3></div>
      ${renderEmployeeTaskContinuityList(continuity.recentTasks)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Active threads</h3></div>
      ${renderEmployeeThreadContinuityList(continuity.activeThreads)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Recent manager decisions</h3></div>
      ${renderEmployeeDecisionContinuityList(continuity.recentManagerDecisions)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Recent control history</h3></div>
      ${renderEmployeeControlContinuityList(continuity.recentControlHistory)}
    </section>
  `;
}

function renderSimpleTaskList(tasks: TaskRecord[]): string {
  if (tasks.length === 0) {
    return `<div class="empty-state small-empty">No tasks.</div>`;
  }

  return `
    <div class="mini-list">
      ${tasks.map((task) => `
        <a class="mini-list-item" href="#task/${encodeURIComponent(task.id)}">
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <div class="muted small">${escapeHtml(task.taskType)} · ${escapeHtml(task.id)}</div>
          </div>
          <span class="${statusClass(task.status)}">${escapeHtml(task.status)}</span>
        </a>
      `).join("")}
    </div>
  `;
}

function renderSimpleThreadList(threads: MessageThreadRecord[]): string {
  if (threads.length === 0) {
    return `<div class="empty-state small-empty">No threads.</div>`;
  }

  return `
    <div class="mini-list">
      ${threads.map((thread) => `
        <a class="mini-list-item" href="#thread/${encodeURIComponent(thread.id)}">
          <div>
            <strong>${escapeHtml(thread.topic)}</strong>
            <div class="muted small">${escapeHtml(thread.id)}</div>
          </div>
          <span class="status">${escapeHtml(threadKind(thread))}</span>
        </a>
      `).join("")}
    </div>
  `;
}

export function renderEmployeesDirectory(overview: OrgPresenceOverview): string {
  const employees = [...overview.employees].sort((a, b) =>
    getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b)),
  );

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Employees</h2>
        <p class="muted">Embodied public employee presence rendered from canonical employee profiles.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employees", employees.length, `${employees.filter((entry) => entry.runtime.runtimeStatus === "implemented").length} implemented`)}
        ${renderSummaryCard("With cognition", employees.filter((entry) => entry.hasCognitiveProfile).length, "cognitive profile present")}
        ${renderSummaryCard("Teams", uniqueTeamIds(overview).length, "visible team presence")}
        ${renderSummaryCard("Active tasks", overview.tasks.length, "canonical work linked below")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Directory</h2>
        <p class="muted">${employees.length} employees</p>
      </div>
      <div class="service-grid">
        ${employees.map((employee) => `
          <a class="unstyled-link" href="#employee/${encodeURIComponent(employee.identity.employeeId)}">
            ${renderEmployeeCard(employee, null)}
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderEmployeeDetail(
  overview: OrgPresenceOverview,
  employeeId: string,
  controlOverview: EmployeeControlOverview,
  effectivePolicy: EmployeeEffectivePolicyOverview,
  continuityOverview: EmployeeContinuityOverview,
): string {
  const employee = overview.employees.find((entry) => entry.identity.employeeId === employeeId);

  if (!employee) {
    return `
      <section class="panel">
        <a class="back-link" href="#employees">← Back to employees</a>
        <div class="empty-state">Employee ${escapeHtml(employeeId)} not found.</div>
      </section>
    `;
  }

  const relatedTasks = overview.tasks.filter((task) => employeeTouchesTask(task, employeeId));
  const relatedThreads = overview.threads.filter((thread) => employeeTouchesThread(thread, employeeId));

  return `
    <a class="back-link" href="#employees">← Back to employees</a>
    ${renderProfileHeader(employee)}
    ${renderEmployeeGovernancePanel(controlOverview, effectivePolicy)}
    ${renderEmployeeContinuityPanel(continuityOverview)}

    <section class="panel">
      <div class="panel-header">
        <h3>Employee work</h3>
        <p class="muted">Canonical work attributed to this employee.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Tasks", relatedTasks.length, `${relatedTasks.filter((task) => task.status === "in_progress").length} in progress`)}
        ${renderSummaryCard("Threads", relatedThreads.length, "created or owned thread presence")}
        ${renderSummaryCard("Team", employee.identity.teamId, "home team")}
        ${renderSummaryCard("Role", employee.identity.roleId, "runtime role")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Related tasks</h3></div>
      ${renderSimpleTaskList(relatedTasks)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Recent threads</h3></div>
      ${renderSimpleThreadList(relatedThreads)}
    </section>
  `;
}

export function renderTeamsOverview(overview: OrgPresenceOverview): string {
  const tasksById = new Map(overview.tasks.map((task) => [task.id, task]));
  const teamIds = uniqueTeamIds(overview);

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Teams</h2>
        <p class="muted">Public team-level presence built from canonical employee and work surfaces.</p>
      </div>
      <div class="service-grid">
        ${teamIds.map((teamId) => {
          const employees = overview.employees.filter((employee) => employee.identity.teamId === teamId);
          const tasks = overview.tasks.filter((task) => teamTouchesTask(task, teamId));
          const threads = overview.threads.filter((thread) => teamTouchesThread(thread, teamId, tasksById));
          const roadmaps = overview.roadmaps.filter((roadmap) => roadmap.team_id === teamId);

          return `
            <article class="work-card">
              <div class="work-card-top">
                <div>
                  <h3><a href="#team/${encodeURIComponent(teamId)}">${escapeHtml(teamId)}</a></h3>
                  <div class="muted small">${employees.length} employees</div>
                </div>
                <span class="status">${escapeHtml(roadmaps.length > 0 ? "roadmap" : "team")}</span>
              </div>
              <div class="meta-grid">
                ${renderCompactPill("Tasks", tasks.length)}
                ${renderCompactPill("Threads", threads.length)}
                ${renderCompactPill("Roadmaps", roadmaps.length)}
                ${renderCompactPill("Implemented", employees.filter((entry) => entry.runtime.runtimeStatus === "implemented").length)}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderTeamDetail(
  overview: OrgPresenceOverview,
  teamId: string,
): string {
  const tasksById = new Map(overview.tasks.map((task) => [task.id, task]));
  const employees = overview.employees.filter((employee) => employee.identity.teamId === teamId);
  const tasks = overview.tasks.filter((task) => teamTouchesTask(task, teamId));
  const threads = overview.threads.filter((thread) => teamTouchesThread(thread, teamId, tasksById));
  const roadmaps = overview.roadmaps.filter((roadmap) => roadmap.team_id === teamId);

  return `
    <section class="panel">
      <a class="back-link" href="#teams">← Back to teams</a>
      <div class="panel-header">
        <h2>${escapeHtml(teamId)}</h2>
        <p class="muted">Canonical team-level work and employee presence.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employees", employees.length, `${employees.filter((entry) => entry.runtime.runtimeStatus === "implemented").length} implemented`)}
        ${renderSummaryCard("Tasks", tasks.length, `${tasks.filter((task) => task.status === "in_progress").length} in progress`)}
        ${renderSummaryCard("Threads", threads.length, "task-linked communication")}
        ${renderSummaryCard("Roadmaps", roadmaps.length, "team strategic objectives")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Employees</h3></div>
      <div class="service-grid">
        ${employees.map((employee) => `
          <a class="unstyled-link" href="#employee/${encodeURIComponent(employee.identity.employeeId)}">
            ${renderEmployeeCard(employee, null)}
          </a>
        `).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Roadmap</h3></div>
      ${renderRoadmapsTable(roadmaps)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Tasks</h3></div>
      ${renderSimpleTaskList(tasks)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Threads</h3></div>
      ${renderSimpleThreadList(threads)}
    </section>
  `;
}

export function renderCompanyOverview(overview: OrgPresenceOverview): string {
  const teamIds = uniqueTeamIds(overview);
  const implementedEmployees = overview.employees.filter(
    (employee) => employee.runtime.runtimeStatus === "implemented",
  ).length;
  const plannedEmployees = overview.employees.filter(
    (employee) => employee.runtime.runtimeStatus === "planned",
  ).length;

  const inProgressTasks = overview.tasks.filter((task) => task.status === "in_progress").length;
  const blockedTasks = overview.tasks.filter((task) => task.status === "blocked").length;

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Company</h2>
        <p class="muted">Embodied organization presence rendered from canonical employees, work, and roadmaps.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employees", overview.employees.length, `${implementedEmployees} implemented · ${plannedEmployees} planned`)}
        ${renderSummaryCard("Teams", teamIds.length, "visible operating teams")}
        ${renderSummaryCard("Tasks", overview.tasks.length, `${inProgressTasks} in progress · ${blockedTasks} blocked`)}
        ${renderSummaryCard("Threads", overview.threads.length, "canonical communication threads")}
        ${renderSummaryCard("Roadmaps", overview.roadmaps.length, "team strategic objectives")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Company surfaces</h3>
      </div>
      <div class="company-link-grid">
        <a class="nav-card" href="#employees">
          <strong>Employees</strong>
          <span class="muted small">Public employee profiles and work presence</span>
        </a>
        <a class="nav-card" href="#teams">
          <strong>Teams</strong>
          <span class="muted small">Team-level work, roadmaps, and employee grouping</span>
        </a>
        <a class="nav-card" href="#work">
          <strong>Work</strong>
          <span class="muted small">Canonical tasks and threads</span>
        </a>
        <a class="nav-card" href="#department">
          <strong>Governance</strong>
          <span class="muted small">Approvals, escalations, controls, and manager oversight</span>
        </a>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Featured employees</h3></div>
      <div class="service-grid">
        ${overview.employees.slice(0, 6).map((employee) => `
          <a class="unstyled-link" href="#employee/${encodeURIComponent(employee.identity.employeeId)}">
            ${renderEmployeeCard(employee, null)}
          </a>
        `).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Roadmap snapshot</h3></div>
      ${renderRoadmapsTable(overview.roadmaps)}
    </section>
  `;
}

export function renderTaskDetail(detail: TaskDetail): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <a class="back-link" href="#work">← Back to work</a>
        <h2>${escapeHtml(detail.task.title)}</h2>
        <p class="muted">${escapeHtml(detail.task.taskType)} · ${escapeHtml(detail.task.id)}</p>
      </div>
      <div class="detail-topline">
        <span class="${statusClass(detail.task.status)}">${escapeHtml(detail.task.status)}</span>
      </div>
      <div class="meta-grid">
        ${renderCompactPill("Assigned team", detail.task.assignedTeamId)}
        ${renderCompactPill("Assigned employee", detail.task.assignedEmployeeId ?? "—")}
        ${renderCompactPill("Originating team", detail.task.originatingTeamId)}
        ${renderCompactPill("Owner", detail.task.ownerEmployeeId ?? "—")}
        ${renderCompactPill("Created by", detail.task.createdByEmployeeId ?? "—")}
        ${renderCompactPill("Blocking deps", detail.task.blockingDependencyCount)}
      </div>
      ${renderTaskVisibilitySummary(detail.visibilitySummary)}
      ${detail.task.payload && Object.keys(detail.task.payload).length > 0
        ? renderExpandableText(`task-payload-${detail.task.id}`, "Task payload", formatJsonBlock(detail.task.payload))
        : ""}
      <p class="muted detail-note">
        This task detail is rendered from canonical AEP state and is suitable for periodic live refresh while execution is active.
      </p>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Causality</h3></div>
      <p class="muted">
        Why this task exists, what triggered it, and which canonical threads/governance flows connect to it.
      </p>
      ${
        (() => {
          const links = buildTaskCausalityLinks(detail);

          const explanation = detail.task.sourceEscalationId
            ? `This task exists because escalation ${detail.task.sourceEscalationId} triggered follow-up work.`
            : detail.task.sourceApprovalId
              ? `This task exists because approval ${detail.task.sourceApprovalId} resulted in follow-up execution.`
              : detail.task.sourceThreadId
                ? `This task was created from discussion in thread ${detail.task.sourceThreadId}.`
                : null;

          return `
            ${
              explanation
                ? `<p class="timeline-causality-summary">${escapeHtml(explanation)}</p>`
                : ""
            }
            ${renderCausalityLinks(links)}
          `;
        })()
      }
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Artifacts</h3></div>
      ${renderArtifactsTable(detail.artifacts)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Dependencies</h3></div>
      ${renderDependenciesTable(detail.dependencies)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Decision</h3></div>
      ${
        detail.decision
          ? `
            <div class="meta-grid">
              ${renderCompactPill("Verdict", detail.decision.verdict)}
              ${renderCompactPill("Employee", detail.decision.employeeId)}
              ${renderCompactPill("Evidence trace", detail.decision.evidenceTraceId ?? "—")}
            </div>
            <div class="detail-paragraph">${escapeHtml(detail.decision.reasoning)}</div>
          `
          : `<div class="empty-state small-empty">No decision recorded.</div>`
      }
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Related threads</h3></div>
      <div class="work-grid">
        ${detail.relatedThreads.length > 0 ? detail.relatedThreads.map(renderThreadCard).join("") : `<div class="empty-state small-empty">No related threads.</div>`}
      </div>
    </section>
  `;
}

function renderThreadDelegationPanel(detail: MessageThreadDetail): string {
  const eligibleMessages = detail.messages.filter((message) => {
    return (
      Boolean(message.responseActionType) &&
      message.responseActionStatus === "applied" &&
      (Boolean(detail.thread.relatedApprovalId) || Boolean(detail.thread.relatedEscalationId))
    );
  });

  if (!detail.thread.relatedApprovalId && !detail.thread.relatedEscalationId) {
    return "";
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <h3>Delegate follow-up task</h3>
        <p class="muted">
          Create a canonical task from an applied approval or escalation outcome.
        </p>
      </div>

      ${
        eligibleMessages.length === 0
          ? `<div class="empty-state small-empty">No applied thread action message is available for task delegation yet.</div>`
          : `
            <form id="thread-delegate-form" class="thread-delegate-form">
              <label class="thread-compose-label" for="thread-delegate-source-message-id">Source message</label>
              <select id="thread-delegate-source-message-id" class="thread-compose-input" required>
                <option value="">Select source message</option>
                ${eligibleMessages
                  .map(
                    (message) => `
                      <option value="${escapeHtml(message.id)}">
                        ${escapeHtml(message.id)} · ${escapeHtml(message.responseActionType ?? "action")} · ${escapeHtml(message.senderEmployeeId)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>

              <div class="thread-delegate-grid">
                <div>
                  <label class="thread-compose-label" for="thread-delegate-originating-team-id">Originating team</label>
                  <input id="thread-delegate-originating-team-id" class="thread-compose-input" type="text" required />
                </div>
                <div>
                  <label class="thread-compose-label" for="thread-delegate-assigned-team-id">Assigned team</label>
                  <input id="thread-delegate-assigned-team-id" class="thread-compose-input" type="text" required />
                </div>
                <div>
                  <label class="thread-compose-label" for="thread-delegate-assigned-employee-id">Assigned employee (optional)</label>
                  <input id="thread-delegate-assigned-employee-id" class="thread-compose-input" type="text" />
                </div>
                <div>
                  <label class="thread-compose-label" for="thread-delegate-owner-employee-id">Owner employee (optional)</label>
                  <input id="thread-delegate-owner-employee-id" class="thread-compose-input" type="text" />
                </div>
                <div>
                  <label class="thread-compose-label" for="thread-delegate-task-type">Task type</label>
                  <input id="thread-delegate-task-type" class="thread-compose-input" type="text" required />
                </div>
                <div>
                  <label class="thread-compose-label" for="thread-delegate-title">Task title</label>
                  <input id="thread-delegate-title" class="thread-compose-input" type="text" required />
                </div>
              </div>

              <label class="thread-compose-label" for="thread-delegate-depends-on">Depends on task IDs (comma or newline separated)</label>
              <input id="thread-delegate-depends-on" class="thread-compose-input" type="text" />

              <label class="thread-compose-label" for="thread-delegate-payload">Payload JSON (optional)</label>
              <textarea
                id="thread-delegate-payload"
                class="thread-compose-textarea"
                placeholder='{"reason":"follow_up"}'
              ></textarea>

              <div class="thread-compose-actions">
                <button type="submit" class="button">Delegate follow-up task</button>
              </div>
            </form>
          `
      }
    </section>
  `;
}

function renderThreadInteractionPanel(detail: MessageThreadDetail): string {
  const approvalActions = detail.thread.relatedApprovalId
    ? `
      <div class="thread-action-row">
        <button
          type="button"
          class="button button-small"
          data-action="thread-approve"
          data-thread-id="${escapeHtml(detail.thread.id)}"
        >
          Approve
        </button>
        <button
          type="button"
          class="button button-small button-secondary"
          data-action="thread-reject"
          data-thread-id="${escapeHtml(detail.thread.id)}"
        >
          Reject
        </button>
      </div>
    `
    : "";

  const escalationActions = detail.thread.relatedEscalationId
    ? `
      <div class="thread-action-row">
        <button
          type="button"
          class="button button-small"
          data-action="thread-acknowledge-escalation"
          data-thread-id="${escapeHtml(detail.thread.id)}"
        >
          Acknowledge escalation
        </button>
        <button
          type="button"
          class="button button-small button-secondary"
          data-action="thread-resolve-escalation"
          data-thread-id="${escapeHtml(detail.thread.id)}"
        >
          Resolve escalation
        </button>
      </div>
    `
    : "";

  return `
    <section class="panel">
      <div class="panel-header">
        <h3>Human participation</h3>
        <p class="muted">
          Send a canonical thread message here. Approval and escalation changes stay explicit.
        </p>
      </div>

      <form id="thread-compose-form" class="thread-compose-form">
        <input type="hidden" id="thread-compose-thread-id" value="${escapeHtml(detail.thread.id)}" />
        <label class="thread-compose-label" for="thread-compose-subject">Subject (optional)</label>
        <input
          id="thread-compose-subject"
          class="thread-compose-input"
          type="text"
          placeholder="Optional subject"
        />

        <label class="thread-compose-label" for="thread-compose-body">Message</label>
        <textarea
          id="thread-compose-body"
          class="thread-compose-textarea"
          placeholder="Write a canonical message to this thread..."
          required
        ></textarea>

        <div class="thread-compose-actions">
          <button type="submit" class="button">Send canonical message</button>
        </div>
      </form>

      ${
        approvalActions || escalationActions
          ? `
            <div class="thread-explicit-actions">
              <h4>Explicit actions</h4>
              <p class="muted small">
                These actions are separate from free-form messages and operate through dedicated canonical routes.
              </p>
              ${approvalActions}
              ${escalationActions}
            </div>
          `
          : ""
      }
    </section>

    ${renderThreadDelegationPanel(detail)}
  `;
}

export function renderThreadDetail(detail: MessageThreadDetail): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <a class="back-link" href="#work">← Back to work</a>
        <h2>${escapeHtml(detail.thread.topic)}</h2>
        <p class="muted">${escapeHtml(detail.thread.id)}</p>
      </div>
      <div class="meta-grid">
        ${renderCompactPill("Visibility", detail.thread.visibility)}
        ${renderCompactPill("Created by", detail.thread.createdByEmployeeId ?? "—")}
        ${renderCompactPill("Related task", detail.thread.relatedTaskId ?? "—")}
        ${renderCompactPill("Related approval", detail.thread.relatedApprovalId ?? "—")}
        ${renderCompactPill("Related escalation", detail.thread.relatedEscalationId ?? "—")}
      </div>
      ${renderThreadVisibility(detail.visibilitySummary)}
      <p class="muted detail-note">
        This is the canonical AEP thread. Slack and email are projections over this thread, not the source of truth.
        This surface is suitable for periodic live refresh while work is active.
      </p>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Causality</h3></div>
      <p class="muted">
        How this thread connects back to canonical work and governance state.
      </p>
      ${
        (() => {
          const links = buildThreadCausalityLinks(detail);

          const explanation = detail.thread.relatedTaskId
            ? `This thread is linked to task ${detail.thread.relatedTaskId} and contributes to its execution.`
            : detail.thread.relatedApprovalId
              ? `This thread contains discussion and decisions for approval ${detail.thread.relatedApprovalId}.`
              : detail.thread.relatedEscalationId
                ? `This thread contains discussion and escalation flow for escalation ${detail.thread.relatedEscalationId}.`
                : null;

          return `
            ${
              explanation
                ? `<p class="timeline-causality-summary">${escapeHtml(explanation)}</p>`
                : ""
            }
            ${renderCausalityLinks(links)}
          `;
        })()
      }
    </section>

    ${renderThreadInteractionPanel(detail)}

    <section class="panel">
      <div class="panel-header"><h3>Messages</h3></div>
      ${renderMessages(detail.messages)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>External mirror state</h3></div>
      <div class="meta-grid">
        ${renderCompactPill("Thread projections", detail.externalThreadProjections.length)}
        ${renderCompactPill("Interaction audit", detail.externalInteractionAudit.length)}
        ${renderCompactPill("Inbound replies allowed", detail.externalInteractionPolicy ? String(detail.externalInteractionPolicy.inboundRepliesAllowed) : "—")}
        ${renderCompactPill("External actions allowed", detail.externalInteractionPolicy ? String(detail.externalInteractionPolicy.externalActionsAllowed) : "—")}
      </div>
      ${(detail.externalThreadProjections.length > 0)
        ? renderExpandableText(`thread-projections-${detail.thread.id}`, "External thread projections", formatJsonBlock(detail.externalThreadProjections))
        : `<div class="empty-state small-empty">No external thread projections.</div>`}
      ${detail.externalInteractionPolicy
        ? renderExpandableText(`thread-policy-${detail.thread.id}`, "External interaction policy", formatJsonBlock(detail.externalInteractionPolicy))
        : ""}
      ${(detail.externalInteractionAudit.length > 0)
        ? renderExpandableText(`thread-audit-${detail.thread.id}`, "External interaction audit", formatJsonBlock(detail.externalInteractionAudit))
        : ""}
    </section>
  `;
}

function summarizeProjectionChannels(item: MirrorThreadOverview): {
  slack: number;
  email: number;
} {
  return item.externalThreadProjections.reduce(
    (acc, projection) => {
      if (projection.channel === "slack") acc.slack += 1;
      if (projection.channel === "email") acc.email += 1;
      return acc;
    },
    { slack: 0, email: 0 },
  );
}

function summarizeAuditDecisions(item: MirrorThreadOverview): {
  allowed: number;
  denied: number;
} {
  return item.externalInteractionAudit.reduce(
    (acc, audit) => {
      if (audit.decision === "allowed") acc.allowed += 1;
      if (audit.decision === "denied") acc.denied += 1;
      return acc;
    },
    { allowed: 0, denied: 0 },
  );
}

function renderProjectionTargets(item: MirrorThreadOverview): string {
  if (item.externalThreadProjections.length === 0) {
    return `<div class="empty-state small-empty">No external thread projections.</div>`;
  }

  return `
    <div class="mirror-target-list">
      ${item.externalThreadProjections
        .map(
          (projection) => `
            <div class="mirror-target-item">
              <div><strong>${escapeHtml(projection.channel)}</strong> · ${escapeHtml(projection.target)}</div>
              <div class="muted small">externalThreadId=${escapeHtml(projection.externalThreadId)}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMirrorThreadCard(item: MirrorThreadOverview): string {
  const channelCounts = summarizeProjectionChannels(item);
  const auditCounts = summarizeAuditDecisions(item);

  return `
    <article class="work-card">
      <div class="work-card-top">
        <div>
          <h3><a href="#thread/${encodeURIComponent(item.thread.id)}">${escapeHtml(item.thread.topic)}</a></h3>
          <div class="muted small">${escapeHtml(item.thread.id)}</div>
        </div>
        <span class="status">${escapeHtml(threadKind(item.thread))}</span>
      </div>

      <div class="meta-grid">
        ${renderCompactPill("Slack", channelCounts.slack)}
        ${renderCompactPill("Email", channelCounts.email)}
        ${renderCompactPill("Allowed actions", auditCounts.allowed)}
        ${renderCompactPill("Denied actions", auditCounts.denied)}
        ${renderCompactPill(
          "Inbound replies",
          item.externalInteractionPolicy
            ? String(item.externalInteractionPolicy.inboundRepliesAllowed)
            : "—",
        )}
        ${renderCompactPill(
          "External actions",
          item.externalInteractionPolicy
            ? String(item.externalInteractionPolicy.externalActionsAllowed)
            : "—",
        )}
      </div>

      <div class="mirror-section-block">
        <div class="mirror-section-title">Projection targets</div>
        ${renderProjectionTargets(item)}
      </div>

      ${renderExpandableText(
        `mirror-thread-projections-${item.thread.id}`,
        "Projection mapping detail",
        formatJsonBlock(item.externalThreadProjections),
      )}

      ${
        item.externalInteractionPolicy
          ? renderExpandableText(
              `mirror-thread-policy-${item.thread.id}`,
              "Interaction policy",
              formatJsonBlock(item.externalInteractionPolicy),
            )
          : ""
      }

      ${
        item.externalInteractionAudit.length > 0
          ? renderExpandableText(
              `mirror-thread-audit-${item.thread.id}`,
              "Interaction audit",
              formatJsonBlock(item.externalInteractionAudit),
            )
          : ""
      }
    </article>
  `;
}

export function renderExternalMirrorOverview(
  overview: ExternalMirrorOverview,
): string {
  const slackProjectionCount = overview.threads.reduce(
    (total, item) =>
      total +
      item.externalThreadProjections.filter(
        (projection) => projection.channel === "slack",
      ).length,
    0,
  );

  const emailProjectionCount = overview.threads.reduce(
    (total, item) =>
      total +
      item.externalThreadProjections.filter(
        (projection) => projection.channel === "email",
      ).length,
    0,
  );

  const auditCount = overview.threads.reduce(
    (total, item) => total + item.externalInteractionAudit.length,
    0,
  );

  const threadsWithReplyPolicy = overview.threads.filter(
    (item) => item.externalInteractionPolicy?.inboundRepliesAllowed === true,
  ).length;

  const threadsWithExternalActions = overview.threads.filter(
    (item) => item.externalInteractionPolicy?.externalActionsAllowed === true,
  ).length;

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>External mirrors</h2>
        <p class="muted">
          Slack and email are adapter projections over canonical AEP threads. They do not replace canonical tasks, threads, approvals, escalations, or provenance.
        </p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Mirrored threads", overview.threads.length, "canonical threads with external visibility")}
        ${renderSummaryCard("Slack projections", slackProjectionCount, "team channels or DMs")}
        ${renderSummaryCard("Email projections", emailProjectionCount, "team aliases or personal addresses")}
        ${renderSummaryCard("Interaction audit", auditCount, "external reply/action decisions")}
        ${renderSummaryCard("Replies enabled", threadsWithReplyPolicy, "threads permitting inbound replies")}
        ${renderSummaryCard("External actions", threadsWithExternalActions, "threads permitting explicit external actions")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Projection overview</h2>
        <p class="muted">
          Open any canonical thread to inspect the underlying source-of-truth conversation. This view keeps external systems visibly secondary to AEP-native state.
        </p>
      </div>
      <div class="work-grid">
        ${
          overview.threads.length > 0
            ? overview.threads.map(renderMirrorThreadCard).join("")
            : `<div class="empty-state">No external mirror projections recorded yet.</div>`
        }
      </div>
    </section>
  `;
}

function renderNarrativeTimelineItem(item: NarrativeTimelineItem): string {
  const href = item.taskId
    ? `#task/${encodeURIComponent(item.taskId)}`
    : item.threadId
      ? `#thread/${encodeURIComponent(item.threadId)}`
      : "#company";

  const causalityLinks = inferNarrativeCausalityLinks(item);

  return `
    <article class="timeline-card">
      <div class="timeline-card-top">
        <div>
          <h3><a href="${escapeHtml(href)}">${escapeHtml(item.title)}</a></h3>
          ${item.subtitle ? `<div class="muted small">${escapeHtml(item.subtitle)}</div>` : ""}
        </div>
        ${item.status ? `<span class="${statusClass(item.status)}">${escapeHtml(item.status)}</span>` : ""}
      </div>

      <div class="meta-grid">
        ${item.teamId ? renderCompactPill("Team", item.teamId) : ""}
        ${item.employeeId ? renderCompactPill("Employee", item.employeeId) : ""}
        ${renderCompactHtmlPill("Time", formatTimestamp(item.at))}
      </div>

      <p class="detail-paragraph">${escapeHtml(item.summary)}</p>

      ${
        item.bullets.length > 0
          ? `
            <ul class="timeline-bullets">
              ${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          `
          : ""
      }

      ${
        causalityLinks.length > 0
          ? `
            <div class="timeline-causality">
              <div class="timeline-causality-title">Why this matters</div>
              ${
                synthesizeCausalityExplanation(item, causalityLinks)
                  ? `<p class="timeline-causality-summary">${escapeHtml(
                      synthesizeCausalityExplanation(item, causalityLinks)!,
                    )}</p>`
                  : ""
              }
              ${renderCausalityLinks(causalityLinks)}
            </div>
          `
          : ""
      }
    </article>
  `;
}

export function renderNarrativeTimeline(timeline: NarrativeTimeline): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Company activity</h2>
        <p class="muted">
          Narrative timeline derived from canonical tasks, threads, artifacts, and governance.
          This surface is suitable for periodic live refresh.
        </p>
      </div>

      <div class="summary-grid">
        ${renderSummaryCard(
          "Stories",
          timeline.items.length,
          "derived from canonical work and communication",
        )}
        ${renderSummaryCard(
          "Task stories",
          timeline.items.filter((item) => item.kind === "task_story").length,
          "execution and validation",
        )}
        ${renderSummaryCard(
          "Approval stories",
          timeline.items.filter((item) => item.kind === "approval_story").length,
          "governance approvals",
        )}
        ${renderSummaryCard(
          "Escalation stories",
          timeline.items.filter((item) => item.kind === "escalation_story").length,
          "governance escalations",
        )}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Narrative timeline</h2>
        <p class="muted">
          A higher-level view of what the company is doing now, built without introducing new canonical state.
        </p>
      </div>

      <div class="timeline-feed">
        ${
          timeline.items.length > 0
            ? timeline.items.map(renderNarrativeTimelineItem).join("")
            : `<div class="empty-state">No activity yet.</div>`
        }
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

    const matchesRuntimeStatus =
      filters.runtimeStatus === "all" ||
      employee.runtime.runtimeStatus === filters.runtimeStatus;

    return matchesSelectedEmployee && matchesRuntimeStatus;
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

  const blockedEmployees = overview.employees.filter((employee) =>
    isEmployeeBlocked(employee),
  ).length;

  const openEscalations = overview.escalations.filter(
    (entry) => entry.state === "open",
  ).length;

  const restrictedEmployees = overview.employees.filter((employee) =>
    isEmployeeRestricted(employee),
  ).length;
  const plannedEmployees = overview.employees.filter(
    (employee) => employee.runtime.runtimeStatus === "planned",
  ).length;

  return `
    <div data-section="department-content">
      <section class="panel">
        <div class="panel-header">
            <h2>Governance</h2>
            <p class="muted">
              Employee controls, approvals, escalations, and manager oversight over canonical company work.
              This governance surface is suitable for periodic live refresh.
            </p>
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
            `${blockedEmployees} blocked · ${restrictedEmployees} restricted · ${plannedEmployees} planned`,
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
