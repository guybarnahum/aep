// --- Safe helpers for employee rendering ---
function getEmployeeDisplayState(employee: OperatorEmployeeRecord): string {
  if (
    employee.employment?.employmentStatus &&
    employee.employment.employmentStatus !== "active"
  ) {
    return employee.employment.employmentStatus;
  }
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
  if (employee.employment?.employmentStatus === "draft") {
    return "Draft employee record awaiting activation.";
  }
  if (employee.employment?.employmentStatus === "on_leave") {
    return "Employee is on leave; continuity logic may reassign work.";
  }
  if (employee.employment?.employmentStatus === "retired") {
    return "Retired employee record retained for continuity and review history.";
  }
  if (employee.employment?.employmentStatus === "terminated") {
    return "Terminated employee retained for audit and reassignment continuity.";
  }
  if (employee.employment?.employmentStatus === "archived") {
    return "Archived employee record outside the active roster.";
  }
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
        <div class="muted small">Employment: ${escapeHtml(employee.employment?.employmentStatus ?? "active")}</div>
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

type PackedRoleGapRow = {
  roleId: string;
  teamId: string;
  state: string;
  reasons: string[];
  sources: Array<{
    reason: string;
    source: Record<string, string>;
    roleGapId: string;
  }>;
};

function packRoleGapsByRoleTeam(gaps: RoleGapRecord[]): PackedRoleGapRow[] {
  const grouped = new Map<string, PackedRoleGapRow>();

  for (const gap of gaps) {
    const key = `${gap.roleId}::${gap.teamId}`;
    const existing =
      grouped.get(key) ??
      {
        roleId: gap.roleId,
        teamId: gap.teamId,
        state: gap.state,
        reasons: [],
        sources: [],
      };

    if (!existing.reasons.includes(gap.reason)) {
      existing.reasons.push(gap.reason);
    }

    existing.sources.push({
      reason: gap.reason,
      source: gap.source,
      roleGapId: gap.roleGapId,
    });

    grouped.set(key, existing);
  }

  return [...grouped.values()].sort((left, right) => {
    const roleCompare = left.roleId.localeCompare(right.roleId);
    return roleCompare !== 0 ? roleCompare : left.teamId.localeCompare(right.teamId);
  });
}

function renderSourceItem(entry: PackedRoleGapRow["sources"][number]): string {
  return `
    <div class="source-list-item">
      <div class="muted small">${escapeHtml(entry.reason)} · ${escapeHtml(entry.roleGapId)}</div>
      <pre class="inline-json">${escapeHtml(JSON.stringify(entry.source, null, 2))}</pre>
    </div>
  `;
}

function renderPackedRoleGapSources(row: PackedRoleGapRow): string {
  if (row.sources.length === 0) {
    return "—";
  }

  if (row.sources.length === 1) {
    return renderSourceItem(row.sources[0]);
  }

  return `
    <details class="inline-details" open>
      <summary>${escapeHtml(row.sources.length)} sources</summary>
      <div class="source-list source-list-scroll">
        ${row.sources.map(renderSourceItem).join("")}
      </div>
    </details>
  `;
}

function renderStaffingGapsTable(gaps: RoleGapRecord[]): string {
  if (gaps.length === 0) {
    return `<div class="empty-state small-empty">No role gaps detected.</div>`;
  }

  const packedRows = packRoleGapsByRoleTeam(gaps);

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>State</th>
          <th>Role</th>
          <th>Team</th>
          <th>Reasons</th>
          <th>Sources</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${packedRows
          .map(
            (row) => `
              <tr>
                <td><span class="${statusClass(row.state)}">${escapeHtml(row.state)}</span></td>
                <td>${escapeHtml(row.roleId)}</td>
                <td>${escapeHtml(row.teamId)}</td>
                <td>
                  <div class="compact-pill-list">
                    ${row.reasons.map((reason) => `<span class="compact-pill">${escapeHtml(reason)}</span>`).join("")}
                  </div>
                </td>
                <td>${renderPackedRoleGapSources(row)}</td>
                <td>
                  <button
                    type="button"
                    class="button button-small"
                    data-action="create-staffing-request-from-gap"
                    data-role-id="${escapeHtml(row.roleId)}"
                    data-team-id="${escapeHtml(row.teamId)}"
                    data-reason="${escapeHtml(row.reasons.join(", "))}"
                    data-source-count="${escapeHtml(String(row.sources.length))}"
                  >
                    Request hire
                  </button>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStaffingRequestsTable(requests: StaffingRequestRecord[]): string {
  if (requests.length === 0) {
    return `<div class="empty-state small-empty">No staffing requests recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Urgency</th>
          <th>Role</th>
          <th>Team</th>
          <th>Reason</th>
          <th>Requested by</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${requests
          .map(
            (request) => `
              <tr>
                <td><span class="${statusClass(request.state)}">${escapeHtml(request.state)}</span></td>
                <td>${escapeHtml(request.urgency)}</td>
                <td>${escapeHtml(request.roleId)}</td>
                <td>${escapeHtml(request.teamId)}</td>
                <td>${escapeHtml(request.reason)}</td>
                <td>${escapeHtml(request.requestedByEmployeeId)}</td>
                <td>
                  <div class="table-actions">
                    ${request.state === "draft" ? `
                      <button class="button button-small" data-action="submit-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Submit</button>
                      <button class="button button-small button-secondary" data-action="cancel-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Cancel</button>
                    ` : ""}
                    ${request.state === "submitted" ? `
                      <button class="button button-small" data-action="approve-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Approve</button>
                      <button class="button button-small button-secondary" data-action="reject-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Reject</button>
                      <button class="button button-small button-secondary" data-action="cancel-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Cancel</button>
                    ` : ""}
                    ${request.state === "approved" ? `
                      <button class="button button-small" data-action="fulfill-staffing-request" data-staffing-request-id="${escapeHtml(request.staffingRequestId)}">Fulfill</button>
                    ` : ""}
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStaffingDashboard(department: DepartmentOverview): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Staffing</h2>
          <p class="muted small">Advisory gaps and canonical hiring requests. UI triggers AEP routes only.</p>
        </div>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Role gaps", department.staffingGaps.summary.roleGaps, "Roles with no active employees")}
        ${renderSummaryCard("Task impacts", department.staffingGaps.summary.taskBlockedByMissingRole, "Tasks affected by missing capacity")}
        ${renderSummaryCard("Requests", department.staffingRequests.length, "Canonical hiring requests")}
      </div>
      <h3>Role gaps</h3>
      ${renderStaffingGapsTable(department.staffingGaps.gaps)}
      <h3>Hiring requests</h3>
      ${renderStaffingRequestsTable(department.staffingRequests)}
    </section>
  `;
}
import type {
  CompanyWorkIntakeOverview,
  ApprovalActionFilter,
  ApprovalRecord,
  ApprovalStatusFilter,
  CausalityLink,
  ControlHistoryRecord,
  DecisionSeverityFilter,
  EmployeeEmploymentEvent,
  EmployeeContinuityOverview,
  EmployeeControlOverview,
  EmployeeEffectivePolicyOverview,
  EmployeeMessageRecord,
  EmployeePerformanceReviewRecord,
  EmployeeReviewCycleRecord,
  EmployeeReviewDimension,
  DepartmentFilters,
  DepartmentOverview,
  EmployeeRuntimeStatusFilter,
  EscalationRecord,
  EscalationStateFilter,
  ExternalMirrorOverview,
  IntakeRequestRecord,
  ManagerDecisionRecord,
  MessageThreadDetail,
  MessageThreadRecord,
  MirrorThreadOverview,
  NarrativeTimeline,
  NarrativeTimelineItem,
  OperatorEmployeeRecord,
  OrgPresenceOverview,
  RoleJobDescriptionProjection,
  RoleGapRecord,
  RuntimeRolePolicyRecord,
  OperatorIdentity,
  ProjectRecord,
  ProductInterventionAction,
  ProductVisibilitySummary,
  StaffingRequestRecord,
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
  TeamLoopResult,
  TenantOverview,
  TenantSummary,
  TeamRoadmap,
  SchedulerStatus,
  TutorialFlowStepState,
  ValidationOverview,
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
    case "executed_task":
      return "status status-completed";
    case "execution_failed":
      return "status status-failed";
    case "no_pending_tasks":
      return "status status-waiting";
    case "waiting_for_staffing":
      return "status status-restricted";
    case "active":
    case "implemented":
      return "status status-completed";
    case "draft":
    case "planned":
      return "status status-waiting";
    case "retired":
    case "terminated":
    case "archived":
    case "disabled":
      return "status status-failed";
    case "completed":
    case "enabled":
    case "resolved":
    case "promote":
      return "status status-completed";
    case "failed":
    case "critical":
    case "disabled_by_manager":
      return "status status-failed";
    case "waiting":
    case "acknowledged":
    case "coach":
    case "no_change":
    case "closed":
    case "disabled_pending_review":
    case "expired":
      return "status status-waiting";
    case "running":
    case "reassign":
      return "status status-running";
    case "on_leave":
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
    case "restrict":
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

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
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
    case "queued":
      return 2;
    case "parked":
      return 3;
    case "blocked":
      return 4;
    case "escalated":
      return 5;
    case "failed":
      return 6;
    case "completed":
      return 7;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
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

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const absolute = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const title = browserTimeZone
    ? `${d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "long",
      })} (${browserTimeZone})`
    : absolute;

  if (relative) {
    return `<span title="${escapeHtml(title)}" class="timestamp">${escapeHtml(relative)} <span class="muted small">${escapeHtml(absolute)}</span></span>`;
  }
  return `<span title="${escapeHtml(title)}" class="timestamp">${escapeHtml(absolute)}</span>`;
}

function formatLocalDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return escapeHtml(value);
  }

  return escapeHtml(
    d.toLocaleString(undefined, {
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
  operator?: OperatorIdentity | null;
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
          ${args.operator ? renderOperatorIdentity(args.operator) : ""}
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

function renderOperatorIdentity(operator: OperatorIdentity): string {
  const label = operator.name || operator.email;
  return `
    <div class="operator-identity" title="${escapeHtml(operator.email)}">
      ${operator.picture
        ? `<img class="operator-avatar" src="${escapeHtml(operator.picture)}" alt="" />`
        : `<span class="operator-avatar operator-avatar-fallback">${escapeHtml(label.slice(0, 1).toUpperCase())}</span>`}
      <span>
        <strong>${escapeHtml(label)}</strong>
        <span class="muted small">${escapeHtml(operator.operatorId)}</span>
      </span>
    </div>
  `;
}

export function renderPrimaryNav(args: {
  activeView:
    | "tenant"
    | "department"
    | "work"
    | "intake-projects"
    | "product-initiatives"
    | "people"
    | "company"
    | "mirrors"
    | "activity"
    | "validation"
    | "runtime-role-policies";
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
        <a class="view-nav-link ${args.activeView === "intake-projects" ? "view-nav-link-active" : ""}" href="#intake-projects">
          Intake &amp; Projects
        </a>
        <a class="view-nav-link ${args.activeView === "product-initiatives" ? "view-nav-link-active" : ""}" href="#product-initiatives">
          Product initiatives
        </a>
        <a class="view-nav-link ${args.activeView === "activity" ? "view-nav-link-active" : ""}" href="#activity">
          Activity
        </a>
        <a class="view-nav-link ${args.activeView === "people" ? "view-nav-link-active" : ""}" href="#employees">
          People
        </a>
        <a class="view-nav-link ${args.activeView === "runtime-role-policies" ? "view-nav-link-active" : ""}" href="#runtime-role-policies">
          Runtime Policies
        </a>
        <a class="view-nav-link ${args.activeView === "company" ? "view-nav-link-active" : ""}" href="#company">
          Company
        </a>
        <a class="view-nav-link ${args.activeView === "mirrors" ? "view-nav-link-active" : ""}" href="#mirrors">
          Mirrors
        </a>
        <a class="view-nav-link ${args.activeView === "validation" ? "view-nav-link-active" : ""}" href="#validation">
          Validation
        </a>
        <a class="view-nav-link ${args.activeView === "department" ? "view-nav-link-active" : ""}" href="#department">
          Governance
        </a>
      </div>
    </section>
  `;
}

export function renderValidationOverview(overview: ValidationOverview): string {
  const scheduler = overview.scheduler;

  return `
    <section class="panel validation-panel">
      <div class="panel-header validation-panel-header">
        <div>
          <h2>Validation Control Loop</h2>
          <p class="muted">
            Cron and manual validation runs over the canonical control-plane surfaces.
          </p>
        </div>
        <div class="validation-actions">
          <button type="button" class="button" data-action="run-validation-now" data-mode="full">
            Run now
          </button>
          <button type="button" class="button button-secondary" data-action="run-validation-now" data-mode="runtime_only">
            Runtime only
          </button>
          ${scheduler.paused
            ? `
              <button type="button" class="button" data-action="resume-validation-scheduler">
                Resume recurring validation
              </button>
            `
            : `
              <button type="button" class="button button-secondary" data-action="pause-validation-scheduler">
                Pause recurring validation
              </button>
            `}
        </div>
      </div>

      <div class="summary-grid validation-summary-grid">
        ${renderSummaryCard("Scheduler", scheduler.paused ? "Paused" : "Active", scheduler.pause_reason ?? "Recurring validation cron ready")}
        ${renderSummaryCard("Runs", overview.summary.total_runs, `${overview.summary.completed_runs} completed · ${overview.summary.failed_runs} failed`)}
        ${renderSummaryCard("Origins", overview.summary.recurring_runs, `${overview.summary.manual_runs} manual · ${overview.summary.post_deploy_runs} post-deploy`)}
        ${renderSummaryCard("Latest result", overview.summary.latest_result_status ?? "—", overview.summary.latest_completed_at ? `Completed ${formatLocalDateTimeLabel(overview.summary.latest_completed_at)}` : "No completed runs yet")}
      </div>

      <div class="validation-scheduler-strip">
        <div>
          <div class="muted small">Scheduler</div>
          <div><span class="${statusClass(scheduler.paused ? "warning" : "active")}">${escapeHtml(scheduler.paused ? "paused" : "active")}</span></div>
        </div>
        <div>
          <div class="muted small">Last requested by</div>
          <div>${escapeHtml(scheduler.last_run_requested_by ?? "—")}</div>
        </div>
        <div>
          <div class="muted small">Last requested at</div>
          <div>${formatTimestamp(scheduler.last_run_requested_at)}</div>
        </div>
        <div>
          <div class="muted small">Last dispatch batch</div>
          <div>${escapeHtml(scheduler.last_dispatch_batch_id ?? "—")}</div>
        </div>
      </div>

      <div class="validation-grid">
        <article class="validation-card">
          <div class="panel-header">
            <h3>Recent Runs</h3>
            <p class="muted small">Latest cron, manual, and post-deploy batches.</p>
          </div>
          ${overview.recent_runs.length === 0
            ? `<div class="empty-state small-empty">No validation runs recorded yet.</div>`
            : `
              <table class="data-table validation-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Type</th>
                    <th>Origin</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Requested / assigned</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${overview.recent_runs
                    .map(
                      (run) => `
                        <tr>
                          <td>${formatTimestamp(run.created_at)}</td>
                          <td>
                            <div>${escapeHtml(run.validation_type)}</div>
                            <div class="muted small">${escapeHtml(run.validation_run_id)}</div>
                          </td>
                          <td><span class="${statusClass(run.origin)}">${escapeHtml(run.origin)}</span></td>
                          <td><span class="${statusClass(run.mode === "runtime_only" ? "waiting" : "running")}">${escapeHtml(run.mode)}</span></td>
                          <td><span class="${statusClass(run.status)}">${escapeHtml(run.status)}</span></td>
                          <td>
                            <div>${escapeHtml(run.requested_by)}</div>
                            <div class="muted small">runner=${escapeHtml(run.assigned_to)}</div>
                          </td>
                          <td>
                            <div>${run.result_status ? `<span class="${statusClass(run.result_status === "warn" ? "warning" : run.result_status)}">${escapeHtml(run.result_status)}</span>` : `<span class="muted small">pending</span>`}</div>
                            ${run.result_summary ? `<div class="muted small">${escapeHtml(run.result_summary)}</div>` : ""}
                            ${run.audit_status ? `<div class="muted small">audit=${escapeHtml(run.audit_status)}</div>` : ""}
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            `}
        </article>

        <article class="validation-card">
          <div class="panel-header">
            <h3>Recent Results</h3>
            <p class="muted small">Persisted results and audit state for the latest validations.</p>
          </div>
          ${overview.recent_results.length === 0
            ? `<div class="empty-state small-empty">No validation results recorded yet.</div>`
            : `
              <table class="data-table validation-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Origin / mode</th>
                    <th>Execution</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  ${overview.recent_results
                    .map(
                      (result) => `
                        <tr>
                          <td>${formatTimestamp(result.created_at)}</td>
                          <td>
                            <div>${escapeHtml(result.validation_type)}</div>
                            <div class="muted small">${escapeHtml(result.validation_result_id)}</div>
                          </td>
                          <td>
                            <span class="${statusClass(result.status === "warn" ? "warning" : result.status)}">${escapeHtml(result.status)}</span>
                            ${result.severity ? `<div class="muted small">severity=${escapeHtml(result.severity)}</div>` : ""}
                          </td>
                          <td>
                            <div>${escapeHtml(result.origin ?? "—")}</div>
                            <div class="muted small">${escapeHtml(result.mode ?? "—")}</div>
                          </td>
                          <td>
                            <div>${escapeHtml(result.executed_by)}</div>
                            <div class="muted small">audit=${escapeHtml(result.audit_status ?? "—")}</div>
                            ${result.audited_by ? `<div class="muted small">by ${escapeHtml(result.audited_by)}</div>` : ""}
                          </td>
                          <td>
                            <div>${escapeHtml(result.summary)}</div>
                            ${result.owner_team ? `<div class="muted small">owner=${escapeHtml(result.owner_team)}</div>` : ""}
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            `}
        </article>
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
      ${task.errorMessage ? `<p class="work-card-error muted small">${escapeHtml(task.errorMessage)}</p>` : ""}
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

function renderStatusPill(status: string): string {
  return `<span class="status-pill">${escapeHtml(status)}</span>`;
}

function defaultTaskGraphJson(): string {
  return escapeHtml(JSON.stringify(
    [
      {
        clientTaskId: "requirements",
        title: "Define project requirements",
        taskType: "project_requirements",
        assignedTeamId: "team_web_product",
      },
      {
        clientTaskId: "implementation",
        title: "Implement project deliverable",
        taskType: "implementation",
        assignedTeamId: "team_web_product",
        dependsOnClientTaskIds: ["requirements"],
      },
      {
        clientTaskId: "deploy",
        title: "Deploy project deliverable",
        taskType: "deployment",
        assignedTeamId: "team_infra",
        dependsOnClientTaskIds: ["implementation"],
      },
      {
        clientTaskId: "validate",
        title: "Validate deployed project",
        taskType: "validation",
        assignedTeamId: "team_validation",
        dependsOnClientTaskIds: ["deploy"],
      },
    ],
    null,
    2,
  ));
}

function renderIntakeCard(intake: IntakeRequestRecord): string {
  const canConvert = intake.status !== "converted" && intake.status !== "rejected";

  return `
    <article class="card">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(intake.title)}</h3>
          <p class="muted">${escapeHtml(intake.id)} · ${escapeHtml(intake.source)} · requested by ${escapeHtml(intake.requestedBy)}</p>
        </div>
        ${renderStatusPill(intake.status)}
      </div>
      <p>${escapeHtml(intake.description ?? "No description provided.")}</p>
      <div class="button-row">
        <button data-action="triage-intake" data-intake-id="${escapeHtml(intake.id)}">Mark triaged</button>
        <button data-action="reject-intake" data-intake-id="${escapeHtml(intake.id)}">Reject</button>
      </div>
      ${
        canConvert
          ? `
            <form class="stacked-form" data-action="convert-intake">
              <input type="hidden" name="intakeId" value="${escapeHtml(intake.id)}" />
              <label>Converted by employee ID
                <input name="convertedByEmployeeId" placeholder="live employee id" required />
              </label>
              <label>Owner team
                <select name="ownerTeamId">
                  <option value="team_web_product">Web/Product</option>
                  <option value="team_infra">Infra</option>
                  <option value="team_validation">Validation</option>
                </select>
              </label>
              <label>Project title
                <input name="projectTitle" value="${escapeHtml(intake.title)}" />
              </label>
              <label>Project description
                <textarea name="projectDescription" rows="2">${escapeHtml(intake.description ?? "")}</textarea>
              </label>
              <label>Public rationale
                <textarea name="rationale" rows="2">Accepted as a canonical AEP project.</textarea>
              </label>
              <button type="submit">Convert to project</button>
            </form>
          `
          : ""
      }
    </article>
  `;
}

function renderProjectCard(project: ProjectRecord): string {
  return `
    <article class="card">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(project.title)}</h3>
          <p class="muted">${escapeHtml(project.id)} · ${escapeHtml(project.ownerTeamId)}</p>
        </div>
        ${renderStatusPill(project.status)}
      </div>
      <p>${escapeHtml(project.description ?? "No description provided.")}</p>
      ${
        project.intakeRequestId
          ? `<p class="muted">Intake: ${escapeHtml(project.intakeRequestId)}</p>`
          : ""
      }
      <form class="stacked-form" data-action="create-project-task-graph">
        <input type="hidden" name="projectId" value="${escapeHtml(project.id)}" />
        <label>Created by employee ID
          <input name="createdByEmployeeId" placeholder="live employee id" required />
        </label>
        <label>Public rationale
          <textarea name="rationale" rows="2">Initial task graph for this project.</textarea>
        </label>
        <label>Task graph JSON
          <textarea name="tasksJson" rows="12">${defaultTaskGraphJson()}</textarea>
        </label>
        <button type="submit">Create task graph</button>
      </form>
    </article>
  `;
}

export function renderIntakeProjectsOverview(
  overview: CompanyWorkIntakeOverview,
): string {
  return `
    <main>
      <section class="panel">
        <h2>Intake &amp; Projects</h2>
        <p class="muted">
          Work enters AEP through intake, becomes projects, then becomes canonical task graphs.
        </p>
      </section>

      <section class="panel">
        <h3>Create intake request</h3>
        <form class="grid-form" data-action="create-intake">
          <label>Company ID
            <input name="companyId" value="company_internal_aep" required />
          </label>
          <label>Requested by
            <input name="requestedBy" value="dashboard_operator" required />
          </label>
          <label>Source
            <input name="source" value="dashboard" required />
          </label>
          <label>Title
            <input name="title" required />
          </label>
          <label class="wide">Description
            <textarea name="description" rows="3"></textarea>
          </label>
          <button type="submit">Submit intake</button>
        </form>
      </section>

      <section class="panel">
        <h3>Intake requests</h3>
        <div class="card-grid">
          ${
            overview.intake.length > 0
              ? overview.intake.map(renderIntakeCard).join("")
              : `<p class="muted">No intake requests yet.</p>`
          }
        </div>
      </section>

      <section class="panel">
        <h3>Projects</h3>
        <div class="card-grid">
          ${
            overview.projects.length > 0
              ? overview.projects.map(renderProjectCard).join("")
              : `<p class="muted">No projects yet.</p>`
          }
        </div>
      </section>
    </main>
  `;
}

const PRODUCT_INTERVENTION_ACTIONS: ProductInterventionAction[] = [
  "add_direction",
  "request_redesign",
  "change_priority",
  "review_validation",
  "review_deployment_risk",
  "pause_for_human_review",
];

export function renderProductInitiativesOverview(projects: ProjectRecord[]): string {
  return `
    <main>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Product initiatives</h2>
            <p class="muted small">Human-visible product work. State remains canonical in AEP projects, tasks, artifacts, approvals, and deployments.</p>
          </div>
        </div>

        <form class="form-grid" id="create-product-initiative-form">
          <input name="title" placeholder="Initiative title" required />
          <input name="createdByEmployeeId" placeholder="Created by employee ID" />
          <select name="initiativeKind">
            <option value="marketing_site">Marketing site</option>
            <option value="customer_intake_surface">Customer intake surface</option>
            <option value="tenant_conversion_surface">Tenant conversion surface</option>
          </select>
          <select name="productSurface">
            <option value="website_bundle">Website bundle</option>
            <option value="customer_intake">Customer intake</option>
            <option value="public_progress">Public progress</option>
          </select>
          <select name="externalVisibility">
            <option value="internal_only">Internal only</option>
            <option value="external_safe">External safe</option>
          </select>
          <textarea name="description" placeholder="Description"></textarea>
          <button class="button" type="submit">Create initiative</button>
        </form>
      </section>

      <section class="panel">
        <h3>Product intake flow</h3>
        <p class="muted small">Manual path for TUTORIAL.md: create intake, then convert it to a product initiative.</p>
        <form class="form-grid" id="create-product-intake-form">
          <input name="title" placeholder="Intake title" value="AEP Marketing Website" required />
          <input name="requestedBy" placeholder="Requested by employee ID" required />
          <textarea name="description" placeholder="Goal, audience, constraints" required></textarea>
          <button class="button" type="submit">Create intake</button>
        </form>
      </section>

      <section class="panel">
        <h3>Initiatives</h3>
        ${projects.length === 0
          ? `<div class="empty-state">No product initiatives yet.</div>`
          : `
          <table class="data-table">
            <thead>
              <tr><th>Title</th><th>Kind</th><th>Surface</th><th>Visibility</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${projects
                .map(
                  (project) => `
                <tr>
                  <td><a href="#product-initiative/${encodeURIComponent(project.id)}">${escapeHtml(project.title)}</a></td>
                  <td>${escapeHtml(project.initiativeKind ?? "—")}</td>
                  <td>${escapeHtml(project.productSurface ?? "—")}</td>
                  <td>${escapeHtml(project.externalVisibility ?? "—")}</td>
                  <td><span class="${statusClass(project.status)}">${escapeHtml(project.status)}</span></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        `}
      </section>
    </main>
  `;
}

export function renderProductInitiativeDetail(summary: ProductVisibilitySummary, lastTeamLoopResult?: TeamLoopResult): string {
  const project = summary.project;
  const errorMessages = Array.from(new Set(
    [...summary.tasks.active, ...summary.tasks.recent]
      .map((t) => t.errorMessage)
      .filter((m): m is string => !!m),
  ));
  const errorBanner = errorMessages.length > 0
    ? `<div class="initiative-error-banner">
        <strong>Runtime errors detected</strong>
        <ul>${errorMessages.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
      </div>`
    : "";

  return `
    <main>
      ${errorBanner}
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>${escapeHtml(project.title)}</h2>
            <p class="muted small">${escapeHtml(project.description ?? "No description.")}</p>
          </div>
          <span class="${statusClass(project.status)}">${escapeHtml(project.status)}</span>
        </div>
        <div class="summary-grid">
          ${renderSummaryCard("Active tasks", summary.tasks.active.length, "Canonical active work")}
          ${renderSummaryCard("Blocked tasks", summary.tasks.blocked.length, "Needs attention")}
          ${renderSummaryCard("Artifacts", summary.artifacts.deployable.length, "Read-only deployable outputs")}
          ${renderSummaryCard("Deployments", summary.deployments.latest.length, "Read-only canonical records")}
        </div>
      </section>

      <section class="panel">
        <h3>Product flow progress</h3>
        <p class="muted small">Read-only checklist derived from canonical AEP state. No mutation.</p>
        ${renderProductFlowProgress(summary)}
      </section>

      <section class="panel">
        <h3>Product operator controls</h3>
        <p class="muted small">These controls call canonical AEP routes only. They do not mutate dashboard-owned state.</p>
        <div class="product-control-grid">
          ${renderExecutionControls(summary, lastTeamLoopResult)}
          ${renderDeploymentControls(summary)}
          ${renderLifecycleControls(summary)}
          ${renderSignalControls(summary)}
        </div>
      </section>

      <section class="panel">
        <h3>Validation and monitoring</h3>
        <p class="muted small">Signals, validation failures, monitoring alerts, and feedback that may drive product evolution.</p>
        ${renderProductSignalPanel(summary)}
      </section>

      <section class="panel">
        <h3>External mirrors</h3>
        <p class="muted small">Read-only external collaboration state. Jira and other tools do not own AEP state.</p>
        ${renderProductExternalMirrorPanel(summary)}
      </section>

      <section class="panel">
        <h3>Staffing and blockers</h3>
        <p class="muted small">Initiative blockers, staffing gaps, and missing-capability signals visible to the product initiator.</p>
        ${renderProductStaffingAndBlockerPanel(summary)}
      </section>

      <section class="panel">
        <h3>Task graph</h3>
        <p class="muted small">Read-only dependency view. This view does not edit tasks or dependencies.</p>
        ${summary.tasks.recent.length === 0
          ? `<div class="empty-state small-empty">No tasks yet.</div>`
          : `
          <div class="task-graph-list">
            ${summary.tasks.recent
              .map(
                (task) => `
              <article class="task-graph-node">
                <div><a href="#task/${encodeURIComponent(task.id)}">${escapeHtml(task.title)}</a></div>
                <div class="muted small">${escapeHtml(task.taskType)} · ${escapeHtml(task.assignedTeamId)}</div>
                <span class="${statusClass(task.status)}">${escapeHtml(task.status)}</span>
                ${task.errorMessage ? `<p class="task-graph-node-error muted small">${escapeHtml(task.errorMessage)}</p>` : ""}
              </article>
            `,
              )
              .join("")}
          </div>
        `}
      </section>

      <section class="panel">
        <h3>Artifact browser</h3>
        <p class="muted small">Read-only deployable artifacts. Artifact creation remains task-owned.</p>
        ${renderProductArtifactBrowser(summary)}
      </section>

      <section class="panel">
        <h3>Deployment panel</h3>
        <p class="muted small">Read-only canonical deployment records. UI does not execute deployments.</p>
        ${renderProductDeploymentPanel(summary)}
      </section>

      <section class="panel">
        <h3>Repository mirror</h3>
        <p class="muted small">Read-only GitHub/provider mirror evidence. GitHub does not own AEP state.</p>
        ${renderProductRepositoryPanel(summary)}
      </section>

      <section class="panel">
        <h3>Human intervention</h3>
        <form class="form-grid" id="product-intervention-form" data-project-id="${escapeHtml(project.id)}">
          <input name="createdByEmployeeId" placeholder="Created by employee ID" required />
          <select name="action">
            <option value="add_direction">Modify requirements</option>
            <option value="request_redesign">Request redesign</option>
            <option value="add_direction">Add constraint</option>
            <option value="pause_for_human_review">Escalate issue</option>
            <option value="pause_for_human_review">Pause work</option>
          </select>
          <p class="muted small">Each action creates canonical AEP work, message, or approval context. It does not mutate project state directly.</p>
          <input name="targetTaskId" placeholder="Optional target task ID" />
          <input name="targetArtifactId" placeholder="Optional target artifact ID" />
          <input name="targetDeploymentId" placeholder="Optional target deployment ID" />
          <textarea name="note" placeholder="Visible steering note" required></textarea>
          <button class="button" type="submit">Create intervention</button>
        </form>
      </section>

      <section class="panel">
        <h3>Decision timeline</h3>
        ${summary.decisions.recent.length === 0
          ? `<div class="empty-state small-empty">No recent public messages.</div>`
          : `
          <table class="data-table">
            <thead><tr><th>Time</th><th>Sender</th><th>Subject</th><th>Message</th></tr></thead>
            <tbody>
              ${summary.decisions.recent
                .map(
                  (message) => `
                <tr>
                  <td>${formatTimestamp(message.createdAt)}</td>
                  <td>${escapeHtml(message.senderEmployeeId)}</td>
                  <td>${escapeHtml(message.subject ?? "—")}</td>
                  <td>${escapeHtml(message.body)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        `}
      </section>
    </main>
  `;
}

function renderDeploymentControls(summary: ProductVisibilitySummary): string {
  const deployments = summary.deployments.latest;
  const deploymentCandidates = getReadyDeploymentCandidates(summary);
  const deploymentApprovalIds = Array.from(
    new Set(
      deployments
        .map((deployment) => deployment.approvalId)
        .filter((approvalId): approvalId is string => Boolean(approvalId)),
    ),
  );

  return `
    <article class="control-card">
      <h4>Deployment controls</h4>
      <p class="muted small">External-safe deployments require approval. Internal-only deployments may execute from requested state.</p>
      <form class="compact-form" data-form="create-deployment-record" data-project-id="${escapeHtml(summary.project.id)}">
        <select name="sourceArtifactId" ${deploymentCandidates.length === 0 ? "disabled" : ""}>
          ${deploymentCandidates.length === 0
            ? `<option value="">No deployment_candidate artifacts ready</option>`
            : deploymentCandidates.map((artifact) => `
              <option value="${escapeHtml(artifact.id)}">${escapeHtml(artifact.id)} · ${escapeHtml(artifact.artifactType)}</option>
            `).join("")}
        </select>
        <input name="requestedByEmployeeId" placeholder="Requested by employee ID" />
        <input name="environment" placeholder="Environment" value="staging" />
        <input name="approvalId" placeholder="Approval ID for external_safe candidates" />
        <button class="button button-small" type="submit" ${deploymentCandidates.length === 0 ? "disabled" : ""}>Create deployment record</button>
      </form>
      <form class="compact-form" data-form="decide-deployment-approval">
        <select name="approvalId" ${deploymentApprovalIds.length === 0 ? "disabled" : ""}>
          ${deploymentApprovalIds.length === 0
            ? `<option value="">No deployment approvals found</option>`
            : deploymentApprovalIds.map((approvalId) => `
              <option value="${escapeHtml(approvalId)}">${escapeHtml(approvalId)}</option>
            `).join("")}
        </select>
        <input name="decidedBy" placeholder="Decided by employee ID" />
        <input name="decisionNote" placeholder="Decision note" />
        <div class="table-actions">
          <button class="button button-small" type="submit" name="decision" value="approve" ${deploymentApprovalIds.length === 0 ? "disabled" : ""}>Approve</button>
          <button class="button button-small button-secondary" type="submit" name="decision" value="reject" ${deploymentApprovalIds.length === 0 ? "disabled" : ""}>Reject</button>
        </div>
      </form>
      <form class="compact-form" data-form="execute-deployment">
        <select name="deploymentId" ${deployments.length === 0 ? "disabled" : ""}>
          ${deployments.length === 0
            ? `<option value="">No deployment records yet</option>`
            : deployments.map((deployment) => `
              <option value="${escapeHtml(deployment.id)}">${escapeHtml(deployment.id)} · ${escapeHtml(deployment.status)} · ${escapeHtml(deployment.externalVisibility)}</option>
            `).join("")}
        </select>
        <input name="executedByEmployeeId" placeholder="Executed by employee ID" />
        <button class="button button-small" type="submit" ${deployments.length === 0 ? "disabled" : ""}>Execute deployment</button>
      </form>
    </article>
  `;
}

function renderLifecycleControls(summary: ProductVisibilitySummary): string {
  const { lifecyclePending, lifecycleApproved } = summary.approvals;

  const pendingOptions = lifecyclePending.length === 0
    ? `<option value="">No pending lifecycle approvals</option>`
    : lifecyclePending.map((a) => {
        const action = typeof a.payload["action"] === "string" ? a.payload["action"] : "unknown";
        return `<option value="${escapeHtml(a.approvalId)}">${escapeHtml(a.approvalId)} — ${escapeHtml(action)}</option>`;
      }).join("");

  const approvedOptions = lifecycleApproved.length === 0
    ? `<option value="">No approved lifecycle approvals</option>`
    : lifecycleApproved.map((a) => {
        const action = typeof a.payload["action"] === "string" ? a.payload["action"] : "unknown";
        const target = typeof a.payload["targetStatus"] === "string" ? a.payload["targetStatus"] : "";
        const label = target ? `${action} → ${target}` : action;
        return `<option value="${escapeHtml(a.approvalId)}">${escapeHtml(a.approvalId)} — ${escapeHtml(label)}</option>`;
      }).join("");

  return `
    <article class="control-card">
      <h4>Lifecycle controls</h4>
      <p class="muted small">Request first; execute only after approval is approved.</p>
      <form class="compact-form" data-form="request-lifecycle" data-project-id="${escapeHtml(summary.project.id)}">
        <select name="action">
          <option value="pause">Pause</option>
          <option value="resume">Resume</option>
          <option value="retire">Retire</option>
          <option value="transition">Transition</option>
        </select>
        <input name="requestedByEmployeeId" placeholder="Requested by employee ID" />
        <input name="reason" placeholder="Reason" />
        <input name="targetState" placeholder="Target state for transition, optional" />
        <button class="button button-small" type="submit">Request lifecycle action</button>
      </form>
      <form class="compact-form" data-form="decide-lifecycle-approval">
        <p class="muted small">Pending approvals (${lifecyclePending.length})</p>
        <select name="approvalId" ${lifecyclePending.length === 0 ? "disabled" : ""}>${pendingOptions}</select>
        <input name="decidedBy" placeholder="Decided by employee ID" />
        <input name="decisionNote" placeholder="Decision note" />
        <div class="table-actions">
          <button class="button button-small" type="submit" name="decision" value="approve" ${lifecyclePending.length === 0 ? "disabled" : ""}>Approve lifecycle</button>
          <button class="button button-small button-secondary" type="submit" name="decision" value="reject" ${lifecyclePending.length === 0 ? "disabled" : ""}>Reject lifecycle</button>
        </div>
      </form>
      <form class="compact-form" data-form="execute-lifecycle" data-project-id="${escapeHtml(summary.project.id)}">
        <p class="muted small">Approved approvals ready to execute (${lifecycleApproved.length})</p>
        <select name="approvalId" ${lifecycleApproved.length === 0 ? "disabled" : ""}>${approvedOptions}</select>
        <input name="executedByEmployeeId" placeholder="Executed by employee ID" />
        <button class="button button-small" type="submit" ${lifecycleApproved.length === 0 ? "disabled" : ""}>Execute lifecycle action</button>
      </form>
    </article>
  `;
}

function renderExecutionControls(summary: ProductVisibilitySummary, lastResult?: TeamLoopResult): string {
  const pendingTasks = summary.tasks.active.filter(
    (task) => task.status === "ready" || task.status === "queued",
  );
  const teamIds = Array.from(new Set(pendingTasks.map((task) => task.assignedTeamId)));

  const lastResultIsError = lastResult != null && lastResult.status !== "executed_task";
  const lastResultMarkup = lastResult
    ? `<div class="meta-grid" style="margin-top:0.5rem">
        ${renderCompactPill("Last result", escapeHtml(lastResult.status))}
        ${lastResult.scanned ? renderCompactPill("Scanned", `${lastResult.scanned.pendingTasks} pending / ${lastResult.scanned.eligibleTasks} eligible`) : renderCompactPill("Scanned", "—")}
        ${lastResult.taskId ? renderCompactHtmlPill("Task", `<a href="#task/${encodeURIComponent(lastResult.taskId)}">${escapeHtml(lastResult.taskId)}</a>`) : renderCompactPill("Task", "—")}
        ${lastResult.employeeId ? renderCompactPill("Employee", lastResult.employeeId) : ""}
      </div>
      <p class="${lastResultIsError ? "work-card-error" : "muted"} small">${escapeHtml(lastResult.message)}</p>`
    : "";

  return `
    <article class="control-card">
      <h4>Task execution</h4>
      <p class="muted small">Manually trigger the team work loop. Use when the cron scheduler is inactive or tasks are stalled in ready/queued state.</p>
      ${teamIds.length === 0
        ? `<p class="muted small">No queued or ready tasks for this initiative.</p>`
        : `<div class="table-actions">
          ${pendingTasks.map((task) => `
            <button class="button button-small" type="button" data-action="run-team-once" data-team-id="${escapeHtml(task.assignedTeamId)}" data-task-id="${escapeHtml(task.id)}">Run ${escapeHtml(task.assignedTeamId)} loop</button>
          `).join("")}
        </div>`}
      ${lastResultMarkup}
    </article>
  `;
}

function renderSignalControls(summary: ProductVisibilitySummary): string {
  return `
    <article class="control-card">
      <h4>Signal simulation</h4>
      <p class="muted small">Send validation, monitoring, or customer feedback signals into AEP.</p>
      <form class="compact-form" data-form="ingest-product-signal" data-project-id="${escapeHtml(summary.project.id)}">
        <select name="source">
          <option value="validation">Validation</option>
          <option value="monitoring">Monitoring</option>
          <option value="customer_intake">Customer intake</option>
        </select>
        <select name="severity">
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="failed">Failed</option>
          <option value="critical">Critical</option>
        </select>
        <input name="title" placeholder="Signal title" required />
        <textarea name="body" placeholder="Signal details" required></textarea>
        <button class="button button-small" type="submit">Send signal</button>
      </form>
    </article>
  `;
}

function renderProductArtifactBrowser(summary: ProductVisibilitySummary): string {
  const artifacts = summary.artifacts.recent;
  if (artifacts.length === 0) {
    return `<div class="empty-state small-empty">No product artifacts recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead><tr><th>Artifact</th><th>Type</th><th>Deployable kind</th><th>State</th><th>Created</th></tr></thead>
      <tbody>
        ${artifacts
          .map(
            (artifact) => `
          <tr>
            <td><span class="mono">${escapeHtml(artifact.id)}</span></td>
            <td>${escapeHtml(artifact.artifactType)}</td>
            <td>${escapeHtml(String(artifact.content.deployableArtifactKind ?? "—"))}</td>
            <td>${escapeHtml(String(artifact.content.state ?? "—"))}</td>
            <td>${formatTimestamp(artifact.createdAt)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderProductDeploymentPanel(summary: ProductVisibilitySummary): string {
  const deployments = summary.deployments.latest;
  if (deployments.length === 0) {
    return `<div class="empty-state small-empty">No deployment records yet.</div>`;
  }

  return `
    <table class="data-table">
      <thead><tr><th>Status</th><th>Environment</th><th>Visibility</th><th>Target URL</th><th>Provider target</th></tr></thead>
      <tbody>
        ${deployments
          .map(
            (deployment) => `
          <tr>
            <td><span class="${statusClass(deployment.status)}">${escapeHtml(deployment.status)}</span></td>
            <td>${escapeHtml(deployment.environment)}</td>
            <td>${escapeHtml(deployment.externalVisibility)}</td>
            <td>${deployment.targetUrl ? `<a href="${escapeHtml(deployment.targetUrl)}" target="_blank" rel="noreferrer">${escapeHtml(deployment.targetUrl)}</a>` : "—"}</td>
            <td><pre class="inline-json">${escapeHtml(JSON.stringify(deployment.deploymentTarget ?? {}))}</pre></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderProductRepositoryPanel(summary: ProductVisibilitySummary): string {
  const repoArtifacts = summary.artifacts.recent.filter(
    (artifact) => artifact.content.deployableArtifactKind === "github_repository",
  );
  const repoDeployments = summary.deployments.latest.filter((deployment) => {
    const provider = deployment.deploymentTarget?.provider;
    return provider === "github";
  });

  if (repoArtifacts.length === 0 && repoDeployments.length === 0) {
    return `<div class="empty-state small-empty">No repository mirror evidence yet.</div>`;
  }

  return `
    <div class="product-evidence-grid">
      ${repoArtifacts
        .map(
          (artifact) => `
        <article class="task-graph-node">
          <strong>${escapeHtml(String((artifact.content.repository as Record<string, unknown> | undefined)?.name ?? artifact.id))}</strong>
          <div class="muted small">Repository artifact · ${formatTimestamp(artifact.createdAt)}</div>
          <pre class="json-block scroll-block">${formatJsonBlock(artifact.content.repository)}</pre>
        </article>
      `,
        )
        .join("")}
      ${repoDeployments
        .map(
          (deployment) => `
        <article class="task-graph-node">
          <strong>${escapeHtml(deployment.id)}</strong>
          <div class="muted small">Provider evidence · ${escapeHtml(deployment.status)}</div>
          <pre class="json-block scroll-block">${formatJsonBlock(deployment.deploymentTarget)}</pre>
        </article>
      `,
        )
        .join("")}
    </div>
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
        ${renderSummaryCard("Allowed tenants", countItems(effectivePolicy.allowedTenants) || countItems(effectivePolicy.effectiveAuthority?.allowedTenants), "effective scope")}
        ${renderSummaryCard("Allowed services", countItems(effectivePolicy.allowedServices) || countItems(effectivePolicy.effectiveAuthority?.allowedServices), "effective scope")}
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

function renderPublicLinksList(employee: OperatorEmployeeRecord): string {
  if (!employee.publicLinks || employee.publicLinks.length === 0) {
    return `<div class="empty-state small-empty">No public links recorded.</div>`;
  }

  return `
    <div class="mini-list">
      ${employee.publicLinks
        .map(
          (link) => `
            <a class="mini-list-item" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
              <div>
                <strong>${escapeHtml(link.type)}</strong>
                <div class="muted small">${escapeHtml(link.url)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="status">${escapeHtml(link.visibility)}</span>
                <span class="muted small">${link.verified ? "verified" : "unverified"}</span>
              </div>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRoleDimensionList(dimensions: EmployeeReviewDimension[]): string {
  if (dimensions.length === 0) {
    return `<div class="empty-state small-empty">No review dimensions defined for this role.</div>`;
  }

  return `
    <div class="mini-list">
      ${dimensions
        .map(
          (dimension) => `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(dimension.label)}</strong>
                <div class="muted small">${escapeHtml(dimension.description)}</div>
              </div>
              <div class="mini-list-meta">
                ${renderCompactPill("Weight", dimension.weight)}
                <span class="muted small">${escapeHtml(dimension.key)}</span>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmploymentEventsList(events: EmployeeEmploymentEvent[]): string {
  if (events.length === 0) {
    return `<div class="empty-state small-empty">No employment lifecycle events recorded.</div>`;
  }

  return `
    <div class="mini-list">
      ${events
        .map(
          (event) => `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(event.eventType.replaceAll("_", " "))}</strong>
                <div class="muted small">${escapeHtml(event.reason ?? "No reason captured")}</div>
                <div class="muted small">${escapeHtml(event.fromTeamId ?? "—")} → ${escapeHtml(event.toTeamId ?? "—")} · ${escapeHtml(event.fromRoleId ?? "—")} → ${escapeHtml(event.toRoleId ?? "—")}</div>
              </div>
              <div class="mini-list-meta">
                ${renderCompactHtmlPill("Effective", formatTimestamp(event.effectiveAt))}
                ${event.approvedBy ? renderCompactPill("Approved", event.approvedBy) : ""}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderReviewCycleList(reviewCycles: EmployeeReviewCycleRecord[]): string {
  if (reviewCycles.length === 0) {
    return `<div class="empty-state small-empty">No review cycles created yet.</div>`;
  }

  return `
    <div class="mini-list">
      ${reviewCycles
        .map(
          (reviewCycle) => `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(reviewCycle.name)}</strong>
                <div class="muted small">${formatTimestamp(reviewCycle.periodStart)} → ${formatTimestamp(reviewCycle.periodEnd)}</div>
              </div>
              <div class="mini-list-meta">
                <span class="${statusClass(reviewCycle.status)}">${escapeHtml(reviewCycle.status)}</span>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmployeeReviewsList(
  reviews: EmployeePerformanceReviewRecord[],
  reviewCyclesById: Map<string, EmployeeReviewCycleRecord>,
): string {
  if (reviews.length === 0) {
    return `<div class="empty-state small-empty">No employee reviews recorded yet.</div>`;
  }

  return `
    <div class="mini-list">
      ${reviews
        .map((review) => {
          const cycle = reviewCyclesById.get(review.reviewCycleId);
          return `
            <article class="mini-list-item">
              <div>
                <strong>${escapeHtml(cycle?.name ?? review.reviewCycleId)}</strong>
                <div class="muted small">${escapeHtml(review.summary)}</div>
                <div class="muted small">strengths: ${escapeHtml(review.strengths.join(", ") || "none")} · gaps: ${escapeHtml(review.gaps.join(", ") || "none")}</div>
              </div>
              <div class="mini-list-meta">
                ${review.recommendations.map((recommendation) => `<span class="${statusClass(recommendation.recommendationType)}">${escapeHtml(recommendation.recommendationType)}</span>`).join("")}
                ${renderCompactPill("Evidence", review.evidence.length)}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRoleCard(
  role: RoleJobDescriptionProjection,
  employeeCount: number,
): string {
  return `
    <article class="directory-card">
      <div class="work-card-top">
        <div>
          <h3><a href="#role/${encodeURIComponent(role.roleId)}">${escapeHtml(role.title)}</a></h3>
          <div class="muted small">${escapeHtml(role.roleId)} · ${escapeHtml(role.teamId)}</div>
        </div>
        <span class="status">${escapeHtml(role.seniorityLevel)}</span>
      </div>
      <p class="muted">${escapeHtml(role.jobDescriptionText)}</p>
      <div class="meta-grid">
        ${renderCompactPill("Employees", employeeCount)}
        ${renderCompactPill("Responsibilities", role.responsibilities.length)}
        ${renderCompactPill("Metrics", role.successMetrics.length)}
        ${renderCompactPill("Review dims", role.reviewDimensions?.length ?? 0)}
      </div>
    </article>
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

function renderTeamLoopStatus(result: TeamLoopResult): string {
  return `
    <article class="work-card">
      <div class="work-card-top">
        <div>
          <h4><a href="#team/${encodeURIComponent(result.teamId)}">${escapeHtml(result.teamId)}</a></h4>
          <div class="muted small">${escapeHtml(result.message)}</div>
        </div>
        <span class="${statusClass(result.status)}">${escapeHtml(result.status)}</span>
      </div>
      <div class="meta-grid">
        ${result.taskId
          ? renderCompactHtmlPill(
              "Task",
              `<a href="#task/${encodeURIComponent(result.taskId)}">${escapeHtml(result.taskId)}</a>`,
            )
          : renderCompactPill("Task", "—")}
        ${renderCompactPill("Employee", result.employeeId ?? "—")}
        ${renderCompactPill("Role", result.roleId ?? "—")}
        ${result.heartbeat?.threadId
          ? renderCompactHtmlPill(
              "Heartbeat",
              `<a href="#thread/${encodeURIComponent(result.heartbeat.threadId)}">${escapeHtml(result.heartbeat.status)}</a>`,
            )
          : renderCompactPill("Heartbeat", result.heartbeat?.status ?? "—")}
        ${result.scanned
          ? renderCompactPill(
              "Scanned",
              `${result.scanned.pendingTasks} pending / ${result.scanned.eligibleTasks} eligible`,
            )
          : renderCompactPill("Scanned", "—")}
      </div>
    </article>
  `;
}

function renderTeamLoopPanel(args: {
  teamId?: string;
  results: TeamLoopResult[];
  schedulerStatus?: SchedulerStatus;
}): string {
  const resultMarkup = args.results.length > 0
    ? `<div class="service-grid">${args.results.map(renderTeamLoopStatus).join("")}</div>`
    : `<div class="empty-state small-empty">Run a team loop from the dashboard to inspect the latest returned status without creating dashboard-owned state.</div>`;
  const buttonMarkup = args.teamId
    ? `<button class="button" type="button" data-action="run-team-once" data-team-id="${escapeHtml(args.teamId)}">Run ${escapeHtml(args.teamId)} once</button>`
    : `<button class="button" type="button" data-action="run-all-teams">Run all team loops</button>`;
  const cadenceMarkup = args.schedulerStatus
    ? `
      <div class="summary-grid">
        ${renderSummaryCard(
          "Team cadence",
          `${args.schedulerStatus.cadence.teamTickIntervalMinutes}m`,
          args.schedulerStatus.cadence.source === "d1" ? "persisted in operator-agent D1" : "using deployed env default",
        )}
        ${renderSummaryCard(
          "Manager cadence",
          `${args.schedulerStatus.cadence.managerTickIntervalMinutes}m`,
          args.schedulerStatus.cadence.updatedAt ? `Updated ${formatTimestamp(args.schedulerStatus.cadence.updatedAt)}` : "no persisted override metadata yet",
        )}
        ${renderSummaryCard(
          "Scheduler",
          args.schedulerStatus.primaryScheduler,
          args.schedulerStatus.cronFallbackEnabled ? "cron fallback enabled" : "cron fallback disabled",
        )}
      </div>

      <form class="management-form" data-action="update-team-loop-cadence">
        <h4>Automatic cadence</h4>
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value="${escapeHtml(args.schedulerStatus.cadence.updatedAt ?? "")}"
        />
        <label>
          <span>Team tick interval (minutes)</span>
          <input name="teamTickIntervalMinutes" type="number" min="1" max="60" value="${escapeHtml(args.schedulerStatus.cadence.teamTickIntervalMinutes)}" />
        </label>
        <label>
          <span>Manager tick interval (minutes)</span>
          <input name="managerTickIntervalMinutes" type="number" min="1" max="60" value="${escapeHtml(args.schedulerStatus.cadence.managerTickIntervalMinutes)}" />
        </label>
        <label>
          <span>Requested by</span>
          <input name="updatedBy" value="dashboard_team_loop_operator" />
        </label>
        <p class="muted small">
          Source: ${escapeHtml(args.schedulerStatus.cadence.source)}
          ${args.schedulerStatus.cadence.updatedBy
            ? ` · Updated by ${escapeHtml(args.schedulerStatus.cadence.updatedBy)}`
            : ""}
          ${args.schedulerStatus.cadence.updatedAt
            ? ` · Updated ${formatTimestamp(args.schedulerStatus.cadence.updatedAt)}`
            : ""}
        </p>
        <button class="button" type="submit">Save cadence</button>
      </form>
    `
    : "";

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Team loops</h3>
          <p class="muted">Manual execution surface over canonical operator-agent team loop routes.</p>
        </div>
        ${buttonMarkup}
      </div>
      ${cadenceMarkup}
      ${resultMarkup}
    </section>
  `;
}

export function renderEmployeesDirectory(
  overview: OrgPresenceOverview,
  roles: RoleJobDescriptionProjection[],
  reviewCycles: EmployeeReviewCycleRecord[],
): string {
  const employees = [...overview.employees].sort((a, b) =>
    getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b)),
  );
  const activeEmployees = employees.filter(
    (entry) => entry.employment.employmentStatus === "active",
  ).length;
  const leaveEmployees = employees.filter(
    (entry) => entry.employment.employmentStatus === "on_leave",
  ).length;

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Employees</h2>
        <p class="muted">Embodied public employee presence rendered from canonical employee profiles.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employees", employees.length, `${employees.filter((entry) => entry.runtime.runtimeStatus === "implemented").length} implemented`)}
        ${renderSummaryCard("Active employment", activeEmployees, `${leaveEmployees} on leave`)}
        ${renderSummaryCard("With cognition", employees.filter((entry) => entry.hasCognitiveProfile).length, "cognitive profile present")}
        ${renderSummaryCard("Roles", roles.length, "job descriptions available")}
        ${renderSummaryCard("Review cycles", reviewCycles.length, "review cadence defined")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>People management</h2>
        <p class="muted">Create employee records and review cycles directly against the operator-agent catalog.</p>
      </div>
      <div class="management-grid">
        <form class="management-form" id="people-create-employee-form">
          <h3>Create employee</h3>
          <label>
            <span>Name</span>
            <input name="employeeName" required placeholder="Avery Patel" />
          </label>
          <label>
            <span>Employee ID</span>
            <input name="employeeId" placeholder="optional override" />
          </label>
          <label>
            <span>Team</span>
            <input name="teamId" required placeholder="team_web_product" />
          </label>
          <label>
            <span>Role</span>
            <select name="roleId" required>
              <option value="">Select role</option>
              ${roles.map((role) => `<option value="${escapeHtml(role.roleId)}">${escapeHtml(role.title)} (${escapeHtml(role.roleId)})</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Runtime status</span>
            <select name="runtimeStatus">
              <option value="active">active</option>
              <option value="planned">planned</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            <span>Employment status</span>
            <select name="employmentStatus">
              <option value="draft">draft</option>
              <option value="active" selected>active</option>
            </select>
          </label>
          <label>
            <span>Scheduler mode</span>
            <input name="schedulerMode" value="auto" />
          </label>
          <label>
            <span>Bio</span>
            <textarea name="bio" rows="4" placeholder="Short public biography"></textarea>
          </label>
          <label>
            <span>Skills</span>
            <input name="skills" placeholder="discovery, planning, coordination" />
          </label>
          <label>
            <span>Approved by</span>
            <input name="approvedBy" value="dashboard-operator" />
          </label>
          <button class="button" type="submit">Create employee</button>
        </form>

        <form class="management-form" id="people-create-review-cycle-form">
          <h3>Create review cycle</h3>
          <label>
            <span>Name</span>
            <input name="name" required placeholder="Q3 2026 performance review" />
          </label>
          <label>
            <span>Period start</span>
            <input name="periodStart" type="date" required />
          </label>
          <label>
            <span>Period end</span>
            <input name="periodEnd" type="date" required />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
            </select>
          </label>
          <label>
            <span>Created by</span>
            <input name="createdBy" value="dashboard-operator" />
          </label>
          <button class="button" type="submit">Create cycle</button>
          ${renderReviewCycleList(reviewCycles)}
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Role catalog</h2>
        <p class="muted">Job descriptions and review dimensions used for lifecycle and performance workflows.</p>
      </div>
      <div class="service-grid">
        ${roles.map((role) => renderRoleCard(role, employees.filter((employee) => employee.identity.roleId === role.roleId).length)).join("")}
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
  employmentEvents: EmployeeEmploymentEvent[],
  reviews: EmployeePerformanceReviewRecord[],
  reviewCycles: EmployeeReviewCycleRecord[],
  roles: RoleJobDescriptionProjection[],
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
  const role = roles.find((entry) => entry.roleId === employee.identity.roleId) ?? null;
  const reviewCyclesById = new Map(reviewCycles.map((entry) => [entry.reviewCycleId, entry]));

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
      <div class="panel-header">
        <h3>Employment and role</h3>
        <p class="muted">Catalog lifecycle state, public links, and current role definition.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employment", employee.employment.employmentStatus, employee.employment.schedulerMode)}
        ${renderSummaryCard("Role title", role?.title ?? employee.identity.roleId, role?.seniorityLevel ?? employee.identity.teamId)}
        ${renderSummaryCard("Public links", employee.publicLinks?.length ?? 0, "profile endpoints")}
        ${renderSummaryCard("Reviews", reviews.length, "performance reviews recorded")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Public links</h3></div>
      ${renderPublicLinksList(employee)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Employment events</h3></div>
      ${renderEmploymentEventsList(employmentEvents)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Performance reviews</h3></div>
      ${renderEmployeeReviewsList(reviews, reviewCyclesById)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Role expectations</h3></div>
      <div class="section-stack">
        ${role
          ? `
            <div class="directory-card">
              <div class="work-card-top">
                <div>
                  <strong><a href="#role/${encodeURIComponent(role.roleId)}">${escapeHtml(role.title)}</a></strong>
                  <div class="muted small">${escapeHtml(role.roleId)} · ${escapeHtml(role.teamId)}</div>
                </div>
                <span class="status">${escapeHtml(role.seniorityLevel)}</span>
              </div>
              <p class="muted">${escapeHtml(role.jobDescriptionText)}</p>
            </div>
            ${renderRoleDimensionList(role.reviewDimensions ?? [])}
          `
          : `<div class="empty-state small-empty">No role catalog entry found for ${escapeHtml(employee.identity.roleId)}.</div>`}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Manage employee</h3>
        <p class="muted">Update public profile fields, trigger lifecycle changes, or record a review.</p>
      </div>
      <div class="management-grid">
        <form class="management-form" id="employee-profile-form" data-employee-id="${escapeHtml(employee.identity.employeeId)}">
          <h4>Update profile</h4>
          <label>
            <span>Name</span>
            <input name="employeeName" value="${escapeHtml(employee.publicProfile?.displayName ?? employee.identity.employeeId)}" />
          </label>
          <label>
            <span>Scheduler mode</span>
            <input name="schedulerMode" value="${escapeHtml(employee.employment.schedulerMode)}" />
          </label>
          <label>
            <span>Bio</span>
            <textarea name="bio" rows="4">${escapeHtml(employee.publicProfile?.bio ?? "")}</textarea>
          </label>
          <label>
            <span>Skills</span>
            <input name="skills" value="${escapeHtml(employee.publicProfile?.skills?.join(", ") ?? "")}" />
          </label>
          <label>
            <span>Avatar URL</span>
            <input name="avatarUrl" value="${escapeHtml(employee.publicProfile?.avatarUrl ?? employee.visualIdentity?.avatarUrl ?? "")}" />
          </label>
          <label>
            <span>Appearance summary</span>
            <textarea name="appearanceSummary" rows="3">${escapeHtml(employee.visualIdentity?.appearanceSummary ?? "")}</textarea>
          </label>
          <label>
            <span>Birth year</span>
            <input name="birthYear" type="number" min="1900" max="2100" value="${escapeHtml(employee.visualIdentity?.birthYear ?? "")}" />
          </label>
          <label>
            <span>Public links</span>
            <textarea name="publicLinks" rows="4" placeholder="github|https://github.com/example|true|public">${escapeHtml((employee.publicLinks ?? []).map((link) => `${link.type}|${link.url}|${String(link.verified)}|${link.visibility}`).join("\n"))}</textarea>
          </label>
          <button class="button" type="submit">Update profile</button>
        </form>

        <form class="management-form" id="employee-lifecycle-form" data-employee-id="${escapeHtml(employee.identity.employeeId)}">
          <h4>Lifecycle action</h4>
          <label>
            <span>Action</span>
            <select name="action">
              <option value="activate">activate</option>
              <option value="reassign-team">reassign-team</option>
              <option value="change-role">change-role</option>
              <option value="start-leave">start-leave</option>
              <option value="end-leave">end-leave</option>
              <option value="retire">retire</option>
              <option value="terminate">terminate</option>
              <option value="rehire">rehire</option>
              <option value="archive">archive</option>
            </select>
          </label>
          <label>
            <span>To team</span>
            <input name="toTeamId" placeholder="required for reassign-team" />
          </label>
          <label>
            <span>To role</span>
            <select name="toRoleId">
              <option value="">Select role</option>
              ${roles.map((entry) => `<option value="${escapeHtml(entry.roleId)}">${escapeHtml(entry.title)} (${escapeHtml(entry.roleId)})</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Reason</span>
            <textarea name="reason" rows="3" placeholder="Why this lifecycle action is needed"></textarea>
          </label>
          <label>
            <span>Approved by</span>
            <input name="approvedBy" value="dashboard-operator" />
          </label>
          <label>
            <span>Effective at</span>
            <input name="effectiveAt" type="datetime-local" />
          </label>
          <button class="button" type="submit">Apply lifecycle action</button>
        </form>

        <form class="management-form" id="employee-review-form" data-employee-id="${escapeHtml(employee.identity.employeeId)}">
          <h4>Record review</h4>
          <label>
            <span>Review cycle</span>
            <select name="reviewCycleId" required>
              <option value="">Select cycle</option>
              ${reviewCycles.map((reviewCycle) => `<option value="${escapeHtml(reviewCycle.reviewCycleId)}">${escapeHtml(reviewCycle.name)} (${escapeHtml(reviewCycle.status)})</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Summary</span>
            <textarea name="summary" rows="4" required placeholder="Performance summary"></textarea>
          </label>
          <label>
            <span>Strengths</span>
            <input name="strengths" placeholder="execution, collaboration" />
          </label>
          <label>
            <span>Gaps</span>
            <input name="gaps" placeholder="prioritization, test depth" />
          </label>
          <label>
            <span>Dimension scores</span>
            <textarea name="dimensionScores" rows="4" placeholder="system_thinking|4|Strong decomposition"></textarea>
          </label>
          <label>
            <span>Recommendations</span>
            <textarea name="recommendations" rows="4" placeholder="coach|Improve stakeholder communication"></textarea>
          </label>
          <label>
            <span>Evidence</span>
            <textarea name="evidence" rows="4" placeholder="task|task_123&#10;artifact|artifact_456"></textarea>
          </label>
          <label>
            <span>Created by</span>
            <input name="createdBy" value="dashboard-operator" />
          </label>
          <button class="button" type="submit">Create review</button>
        </form>
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

export function renderTeamsOverview(
  overview: OrgPresenceOverview,
  teamLoopResults: TeamLoopResult[] = [],
): string {
  const tasksById = new Map(overview.tasks.map((task) => [task.id, task]));
  const teamIds = uniqueTeamIds(overview);

  return `
    ${renderTeamLoopPanel({
      results: teamLoopResults,
      schedulerStatus: overview.schedulerStatus,
    })}

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
  teamLoopResult?: TeamLoopResult,
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

    ${renderTeamLoopPanel({
      teamId,
      results: teamLoopResult ? [teamLoopResult] : [],
      schedulerStatus: overview.schedulerStatus,
    })}

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
          <strong>People</strong>
          <span class="muted small">Directory, staffing, lifecycle, and employee presence</span>
        </a>
        <a class="nav-card" href="#roles">
          <strong>Roles</strong>
          <span class="muted small">Job descriptions, review dimensions, and staffing context</span>
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

export function renderRolesCatalog(
  roles: RoleJobDescriptionProjection[],
  overview: OrgPresenceOverview,
): string {
  const sortedRoles = [...roles].sort((left, right) => left.title.localeCompare(right.title));

  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Roles</h2>
        <p class="muted">Canonical job descriptions and performance review dimensions from the operator-agent role catalog.</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Roles", sortedRoles.length, "catalog entries")}
        ${renderSummaryCard("Teams", new Set(sortedRoles.map((entry) => entry.teamId)).size, "teams represented")}
        ${renderSummaryCard("Review dimensions", sortedRoles.reduce((sum, entry) => sum + (entry.reviewDimensions?.length ?? 0), 0), "total score dimensions")}
        ${renderSummaryCard("Employees mapped", overview.employees.filter((employee) => sortedRoles.some((role) => role.roleId === employee.identity.roleId)).length, "employees with cataloged roles")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Catalog</h3></div>
      <div class="service-grid">
        ${sortedRoles.map((role) => renderRoleCard(role, overview.employees.filter((employee) => employee.identity.roleId === role.roleId).length)).join("")}
      </div>
    </section>
  `;
}

function renderRuntimePolicyJsonBlock(value: unknown): string {
  return `<pre class="json-block scroll-block">${formatJsonBlock(value)}</pre>`;
}

function renderRuntimeRolePolicyEditor(
  role: RoleJobDescriptionProjection,
  policy: RuntimeRolePolicyRecord | null,
): string {
  const defaultPolicy = {
    authority: {
      allowedOperatorActions: [],
      allowedTenants: [],
      allowedServices: [],
      allowedEnvironmentNames: [],
      requireTraceVerification: true,
    },
    budget: {
      maxActionsPerScan: 0,
      maxActionsPerHour: 0,
      maxActionsPerTenantPerHour: 0,
      tokenBudgetDaily: 0,
      runtimeBudgetMsPerScan: 5000,
      verificationReadsPerAction: 0,
    },
    escalation: {
      onBudgetExhausted: "notify-human",
      onRepeatedVerificationFailure: "notify-human",
      onProdTenantAction: "require-manager-approval",
    },
  };

  const current = policy ?? {
    roleId: role.roleId,
    ...defaultPolicy,
  };

  return `
    <div class="panel-header">
      <div>
        <h3>${escapeHtml(role.title)}</h3>
        <p class="muted small">
          ${escapeHtml(role.roleId)} · ${escapeHtml(role.teamId)} · implementation=${escapeHtml(role.implementationBinding ?? "none")}
        </p>
      </div>
      <span class="${policy ? "status status-completed" : "status status-failed"}">
        ${policy ? "policy present" : "new policy"}
      </span>
    </div>

    <form id="runtime-role-policy-form" data-role-id="${escapeHtml(role.roleId)}" class="form-grid">
      <label>
        <span>Authority JSON</span>
        <textarea name="authority" rows="12" spellcheck="false">${escapeHtml(JSON.stringify(current.authority, null, 2))}</textarea>
      </label>

      <label>
        <span>Budget JSON</span>
        <textarea name="budget" rows="10" spellcheck="false">${escapeHtml(JSON.stringify(current.budget, null, 2))}</textarea>
      </label>

      <label>
        <span>Escalation JSON</span>
        <textarea name="escalation" rows="8" spellcheck="false">${escapeHtml(JSON.stringify(current.escalation, null, 2))}</textarea>
      </label>

      <label>
        <span>Reason</span>
        <input name="reason" value="Dashboard runtime role policy update" />
      </label>

      <label>
        <span>Updated by</span>
        <input name="updatedBy" value="human_dashboard_operator" />
      </label>

      <div class="warning-callout">
        Runtime policy changes affect future employee execution. Unsupported operator actions,
        invalid escalation actions, malformed JSON, and negative budgets are rejected by the API.
      </div>

      <div class="form-actions">
        <button type="submit" class="button">Save runtime policy</button>
        <a class="button button-secondary" href="#roles">Back to roles</a>
      </div>
    </form>

    <details class="expandable-block">
      <summary>Current effective policy JSON</summary>
      ${renderRuntimePolicyJsonBlock(current)}
    </details>
  `;
}

export function renderRuntimeRolePoliciesPage(args: {
  roles: RoleJobDescriptionProjection[];
  policies: RuntimeRolePolicyRecord[];
  selectedRoleId?: string | null;
}): string {
  const policyByRole = new Map(args.policies.map((policy) => [policy.roleId, policy]));
  const runtimeRoles = args.roles.filter((role) => role.runtimeEnabled === true);
  const selectedRoleId = args.selectedRoleId ?? runtimeRoles[0]?.roleId ?? null;
  const selectedRole = runtimeRoles.find((role) => role.roleId === selectedRoleId) ?? null;
  const selectedPolicy = selectedRoleId ? policyByRole.get(selectedRoleId) ?? null : null;

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Runtime Role Policies</h2>
          <p class="muted">
            Edit runtime authority, budget, and escalation policy for runtime-enabled roles.
            Implementation bindings remain code-owned and are not editable here.
          </p>
        </div>
      </div>

      <div class="split-layout">
        <aside class="side-list">
          ${runtimeRoles
            .map((role) => {
              const hasPolicy = policyByRole.has(role.roleId);
              const selected = role.roleId === selectedRoleId;
              return `
                <a
                  class="side-list-item ${selected ? "side-list-item-selected" : ""}"
                  href="#runtime-role-policies/${encodeURIComponent(role.roleId)}"
                >
                  <strong>${escapeHtml(role.title)}</strong>
                  <span class="muted small">${escapeHtml(role.roleId)} · ${escapeHtml(role.teamId)}</span>
                  <span class="${hasPolicy ? "status status-completed" : "status status-failed"}">
                    ${hasPolicy ? "policy present" : "missing policy"}
                  </span>
                </a>
              `;
            })
            .join("")}
        </aside>

        <section class="detail-panel">
          ${selectedRole
            ? renderRuntimeRolePolicyEditor(selectedRole, selectedPolicy)
            : `<div class="empty-state">No runtime-enabled roles found.</div>`}
        </section>
      </div>
    </section>
  `;
}

export function renderRoleDetail(
  roleId: string,
  roles: RoleJobDescriptionProjection[],
  overview: OrgPresenceOverview,
  reviewCycles: EmployeeReviewCycleRecord[],
): string {
  const role = roles.find((entry) => entry.roleId === roleId);
  if (!role) {
    return `
      <section class="panel">
        <a class="back-link" href="#roles">← Back to roles</a>
        <div class="empty-state">Role ${escapeHtml(roleId)} not found.</div>
      </section>
    `;
  }

  const employees = overview.employees.filter((employee) => employee.identity.roleId === role.roleId);

  return `
    <section class="panel">
      <a class="back-link" href="#roles">← Back to roles</a>
      <div class="panel-header">
        <h2>${escapeHtml(role.title)}</h2>
        <p class="muted">${escapeHtml(role.roleId)} · ${escapeHtml(role.teamId)} · ${escapeHtml(role.seniorityLevel)}</p>
      </div>
      <div class="summary-grid">
        ${renderSummaryCard("Employees", employees.length, "current roster")}
        ${renderSummaryCard("Responsibilities", role.responsibilities.length, "role expectations")}
        ${renderSummaryCard("Success metrics", role.successMetrics.length, "evaluation signals")}
        ${renderSummaryCard("Review cycles", reviewCycles.length, "available for assessment")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Job description</h3></div>
      <p class="muted">${escapeHtml(role.jobDescriptionText)}</p>
      <div class="management-grid">
        <div class="directory-card">
          <h4>Responsibilities</h4>
          <ul>
            ${role.responsibilities.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
          </ul>
        </div>
        <div class="directory-card">
          <h4>Success metrics</h4>
          <ul>
            ${role.successMetrics.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
          </ul>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Constraints and review dimensions</h3></div>
      <div class="management-grid">
        <div class="directory-card">
          <h4>Constraints</h4>
          <ul>
            ${role.constraints.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
          </ul>
        </div>
        <div>
          ${renderRoleDimensionList(role.reviewDimensions ?? [])}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Current employees</h3></div>
      <div class="service-grid">
        ${employees.map((employee) => `<a class="unstyled-link" href="#employee/${encodeURIComponent(employee.identity.employeeId)}">${renderEmployeeCard(employee, null)}</a>`).join("")}
      </div>
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

      ${renderStaffingDashboard(overview)}

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

function getReadyDeploymentCandidates(summary: ProductVisibilitySummary): TaskArtifactRecord[] {
  return summary.artifacts.deployable.filter(
    (artifact) =>
      artifact.content?.deployableArtifactKind === "deployment_candidate" &&
      artifact.content?.state === "ready_for_deployment" &&
      artifact.content?.stateOwnership === "aep",
  );
}

function renderProductFlowProgress(summary: ProductVisibilitySummary): string {
  const project = summary.project;

  function stepState(
    condition: boolean,
    blockedBy?: boolean,
  ): TutorialFlowStepState {
    if (condition) return "done";
    if (blockedBy) return "blocked";
    return "ready";
  }

  function stepClass(state: TutorialFlowStepState): string {
    switch (state) {
      case "done": return "product-flow-step product-flow-done";
      case "ready": return "product-flow-step product-flow-ready";
      case "blocked": return "product-flow-step product-flow-blocked";
      case "missing": return "product-flow-step product-flow-missing";
    }
  }

  function stepIcon(state: TutorialFlowStepState): string {
    switch (state) {
      case "done": return "✅";
      case "ready": return "▶";
      case "blocked": return "⏳";
      case "missing": return "○";
    }
  }

  const hasIntake = Boolean(summary.intake.source);
  const hasProject = Boolean(project.id);
  const hasTaskGraph = summary.tasks.count > 0;
  const hasArtifacts = summary.artifacts.count > 0;
  const hasDeploymentCandidate = getReadyDeploymentCandidates(summary).length > 0;
  const hasDeploymentRecord = summary.deployments.count > 0;
  const hasExecutedDeployment = summary.deployments.latest.some(
    (d) => d.status === "deployed",
  );

  const intakeState = stepState(hasIntake);
  const projectState = stepState(hasProject, !hasIntake);
  const taskGraphState = stepState(hasTaskGraph, !hasProject);
  const artifactState = stepState(hasArtifacts, !hasTaskGraph);
  const candidateState = stepState(hasDeploymentCandidate, !hasArtifacts);
  const deploymentRecordState = stepState(hasDeploymentRecord, !hasDeploymentCandidate);
  const executionState = stepState(hasExecutedDeployment, !hasDeploymentRecord);

  const steps: Array<{ label: string; state: TutorialFlowStepState }> = [
    { label: "Intake submitted", state: intakeState },
    { label: "Product initiative created", state: projectState },
    { label: "Task graph created", state: taskGraphState },
    { label: "Artifacts produced", state: artifactState },
    { label: "Deployment candidate ready", state: candidateState },
    { label: "Deployment record created", state: deploymentRecordState },
    { label: "Deployment executed", state: executionState },
  ];

  return `
    <div class="product-flow-grid">
      ${steps.map((step) => `
        <div class="${stepClass(step.state)}">
          <span class="product-flow-icon">${stepIcon(step.state)}</span>
          <span>${escapeHtml(step.label)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderProductSignalPanel(summary: ProductVisibilitySummary): string {
  const signalMessages = summary.decisions.recent.filter((message) => {
    const kind = message.payload && typeof message.payload.kind === "string"
      ? message.payload.kind
      : "";
    return [
      "product_signal",
      "jira_status_signal",
      "validation_failure",
      "monitoring_alert",
      "product_intervention",
    ].includes(kind);
  });

  if (signalMessages.length === 0) {
    return `<div class="empty-state small-empty">No validation, monitoring, or feedback signals recorded.</div>`;
  }

  return `
    <table class="data-table">
      <thead><tr><th>Signal</th><th>Source</th><th>Message</th><th>When</th></tr></thead>
      <tbody>
        ${signalMessages.map((message) => `
          <tr>
            <td>${escapeHtml(String(message.payload?.kind ?? message.type))}</td>
            <td>${escapeHtml(String(message.payload?.source ?? message.source ?? "aep"))}</td>
            <td>${escapeHtml(message.subject ?? message.body ?? "—")}</td>
            <td>${formatTimestamp(message.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderProductExternalMirrorPanel(summary: ProductVisibilitySummary): string {
  const mirrorMessages = summary.decisions.recent.filter((message) => {
    const kind = message.payload && typeof message.payload.kind === "string"
      ? message.payload.kind
      : "";
    return kind.startsWith("jira_") || kind.includes("mirror");
  });

  if (mirrorMessages.length === 0) {
    return `<div class="empty-state small-empty">No external mirror activity recorded for this initiative.</div>`;
  }

  return `
    <table class="data-table">
      <thead><tr><th>Mirror event</th><th>External ref</th><th>Canonical effect</th></tr></thead>
      <tbody>
        ${mirrorMessages.map((message) => `
          <tr>
            <td>${escapeHtml(String(message.payload?.kind ?? "external_mirror"))}</td>
            <td>${escapeHtml(String(message.payload?.externalTicketId ?? message.externalMessageId ?? "—"))}</td>
            <td>${escapeHtml("thread/message only")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderProductStaffingAndBlockerPanel(summary: ProductVisibilitySummary): string {
  const blockedTasks = summary.tasks.recent.filter((task) => task.status === "blocked");
  const staffingMessages = summary.decisions.recent.filter((message) => {
    const kind = message.payload && typeof message.payload.kind === "string"
      ? message.payload.kind
      : "";
    return kind.includes("staffing") || kind.includes("role_gap");
  });

  if (blockedTasks.length === 0 && staffingMessages.length === 0) {
    return `<div class="empty-state small-empty">No staffing gaps or blockers visible for this initiative.</div>`;
  }

  return `
    <div class="product-evidence-grid">
      ${blockedTasks.map((task) => `
        <article class="task-graph-node">
          <strong>${escapeHtml(task.title)}</strong>
          <div class="muted small">${escapeHtml(task.id)} · ${escapeHtml(task.status)}</div>
        </article>
      `).join("")}
      ${staffingMessages.map((message) => `
        <article class="task-graph-node">
          <strong>${escapeHtml(message.subject ?? "Staffing signal")}</strong>
          <pre class="json-block scroll-block">${formatJsonBlock(message.payload)}</pre>
        </article>
      `).join("")}
    </div>
  `;
}
