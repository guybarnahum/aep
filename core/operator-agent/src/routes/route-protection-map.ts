/**
 * Route Protection Map
 *
 * Inventory of every operator-agent route and its protection class.
 * This file is documentation + CI-enforced contract today.
 * Auth middleware will consume it once roles/permissions land.
 *
 * Protection classes:
 *   public_read       — unauthenticated safe reads (health, build-info)
 *   operator_read     — authenticated read, ordinary dashboard viewer
 *   operator_action   — operator-triggered mutation (approvals, escalations, governance)
 *   admin_dev         — test/cleanup/seed endpoints; should require qa.cleanup or admin.dev
 *   admin_runtime     — run/schedule/policy mutation; should require admin.runtime
 *   admin_hr          — employee lifecycle & persona; should require hr.manage + hr.lifecycle
 *   admin_hr_staffing — hiring request creation/fulfillment; should require hr.staffing
 *   admin_governance  — approval/escalation mutation; should require governance.approve
 *   admin_product     — project/deployment/execution mutation; should require product.manage
 */

export type RouteProtectionClass =
  | "public_read"
  | "operator_read"
  | "operator_action"
  | "admin_dev"
  | "admin_runtime"
  | "admin_hr"
  | "admin_hr_staffing"
  | "admin_governance"
  | "admin_product";

export interface RouteProtectionEntry {
  /** Exact pathname or prefix pattern (trailing * means prefix match). */
  pattern: string;
  /** HTTP methods this entry covers. "*" means all methods. */
  methods: string[];
  protectionClass: RouteProtectionClass;
  /** Human-readable intent note. */
  note: string;
  /** True when the route is already gated in index.ts by ENABLE_TEST_ENDPOINTS or a token. */
  currentlyGated?: boolean;
}

export const ROUTE_PROTECTION_MAP: RouteProtectionEntry[] = [
  // ── Public / infra ────────────────────────────────────────────────────────
  {
    pattern: "/",
    methods: ["GET"],
    protectionClass: "public_read",
    note: "Root index / worker info",
  },
  {
    pattern: "/healthz",
    methods: ["GET"],
    protectionClass: "public_read",
    note: "Health probe",
  },
  {
    pattern: "/build-info",
    methods: ["GET"],
    protectionClass: "public_read",
    note: "Build metadata",
  },
  {
    pattern: "/agent/auth/me",
    methods: ["GET"],
    protectionClass: "public_read",
    note: "Auth identity — must remain accessible to bootstrap the auth check itself",
  },

  // ── Operator reads ─────────────────────────────────────────────────────────
  {
    pattern: "/agent/employees",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "List employees",
  },
  {
    pattern: "/agent/employees/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Employee detail, scope, reviews, employment events, policy overview",
  },
  {
    pattern: "/agent/employee-controls",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Employee control overview",
  },
  {
    pattern: "/agent/roles",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Role catalog",
  },
  {
    pattern: "/agent/tasks",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Task list",
  },
  {
    pattern: "/agent/tasks/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Task detail and artifacts",
  },
  {
    pattern: "/agent/message-threads",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Thread list",
  },
  {
    pattern: "/agent/message-threads/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Thread detail, inbox, outbox",
  },
  {
    pattern: "/agent/inbox/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Inbox",
  },
  {
    pattern: "/agent/outbox/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Outbox",
  },
  {
    pattern: "/agent/messages",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Message list",
  },
  {
    pattern: "/agent/escalations",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Escalation list",
  },
  {
    pattern: "/agent/escalations/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Escalation detail",
  },
  {
    pattern: "/agent/approvals",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Approval list",
  },
  {
    pattern: "/agent/approvals/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Approval detail",
  },
  {
    pattern: "/agent/control-history",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Operator control history",
  },
  {
    pattern: "/agent/manager-log",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Manager decision log",
  },
  {
    pattern: "/agent/roadmaps",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Team roadmaps",
  },
  {
    pattern: "/agent/review-cycles",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Review cycles",
  },
  {
    pattern: "/agent/staffing/role-gaps",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Advisory staffing gap detection",
  },
  {
    pattern: "/agent/staffing/requests",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "List staffing requests",
  },
  {
    pattern: "/agent/staffing/requests/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Staffing request detail",
  },
  {
    pattern: "/agent/runtime-role-policies",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "List runtime role policies",
  },
  {
    pattern: "/agent/runtime-role-policies/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Runtime role policy detail",
  },
  {
    pattern: "/agent/mirror-routing-rules",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Mirror routing rules",
  },
  {
    pattern: "/agent/intake",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Intake request list",
  },
  {
    pattern: "/agent/intake/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Intake request detail",
  },
  {
    pattern: "/agent/projects",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Project list",
  },
  {
    pattern: "/agent/projects/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Project detail and visibility",
  },
  {
    pattern: "/agent/product-deployments",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Deployment list",
  },
  {
    pattern: "/agent/product-deployments/*",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Deployment detail",
  },
  {
    pattern: "/agent/work-log",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Work log",
  },
  {
    pattern: "/agent/scheduler-status",
    methods: ["GET"],
    protectionClass: "operator_read",
    note: "Scheduler state read",
  },

  // ── Admin: runtime execution ───────────────────────────────────────────────
  // Future required permission: admin.runtime
  {
    pattern: "/__scheduled",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Trigger scheduled cron manually",
    currentlyGated: true, // ENABLE_TEST_ENDPOINTS
  },
  {
    pattern: "/agent/run",
    methods: ["POST"],
    protectionClass: "admin_runtime",
    note: "Run all team agents",
  },
  {
    pattern: "/agent/run-once",
    methods: ["POST"],
    protectionClass: "admin_runtime",
    note: "Run all team agents once",
  },
  {
    pattern: "/agent/teams/run",
    methods: ["POST"],
    protectionClass: "admin_runtime",
    note: "Run all teams",
  },
  {
    pattern: "/agent/teams/*/run-once",
    methods: ["POST"],
    protectionClass: "admin_runtime",
    note: "Run a single team once",
  },
  {
    pattern: "/agent/scheduler-status",
    methods: ["POST"],
    protectionClass: "admin_runtime",
    note: "Update scheduler cadence / pause / resume",
  },

  // ── Admin: runtime role policy mutation ───────────────────────────────────
  // Future required permission: admin.runtime
  {
    pattern: "/agent/runtime-role-policies/*",
    methods: ["PATCH", "PUT"],
    protectionClass: "admin_runtime",
    note: "Upsert runtime role policy — future home: /admin/runtime/role-policies/*",
  },

  // ── Admin: governance (approvals / escalations) ───────────────────────────
  // Future required permission: governance.approve, governance.escalation
  {
    pattern: "/agent/approvals/approve",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Approve an approval record",
  },
  {
    pattern: "/agent/approvals/reject",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Reject an approval record",
  },
  {
    pattern: "/agent/escalations/acknowledge",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Acknowledge an escalation",
  },
  {
    pattern: "/agent/escalations/resolve",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Resolve an escalation",
  },
  {
    pattern: "/agent/message-threads/*/approve",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Approve from thread context",
  },
  {
    pattern: "/agent/message-threads/*/reject",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Reject from thread context",
  },
  {
    pattern: "/agent/message-threads/*/acknowledge-escalation",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Acknowledge escalation from thread context",
  },
  {
    pattern: "/agent/message-threads/*/resolve-escalation",
    methods: ["POST"],
    protectionClass: "admin_governance",
    note: "Resolve escalation from thread context",
  },

  // ── Admin: HR — employee lifecycle ────────────────────────────────────────
  // Future required permissions: hr.manage, hr.lifecycle
  {
    pattern: "/agent/employees",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Create employee",
  },
  {
    pattern: "/agent/employees/*",
    methods: ["PATCH"],
    protectionClass: "admin_hr",
    note: "Update employee profile",
  },
  {
    pattern: "/agent/employees/*/activate",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Activate employee",
  },
  {
    pattern: "/agent/employees/*/reassign-team",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Reassign employee to team",
  },
  {
    pattern: "/agent/employees/*/change-role",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Change employee role",
  },
  {
    pattern: "/agent/employees/*/start-leave",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Start employee leave",
  },
  {
    pattern: "/agent/employees/*/end-leave",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "End employee leave",
  },
  {
    pattern: "/agent/employees/*/retire",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Retire employee",
  },
  {
    pattern: "/agent/employees/*/terminate",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Terminate employee",
  },
  {
    pattern: "/agent/employees/*/rehire",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Rehire employee",
  },
  {
    pattern: "/agent/employees/*/archive",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Archive employee",
  },
  {
    pattern: "/agent/employees/*/generate-persona",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Generate employee persona prompt — requires admin.runtime in addition",
  },
  {
    pattern: "/agent/employees/*/approve-persona",
    methods: ["POST"],
    protectionClass: "admin_hr",
    note: "Approve employee persona — requires admin.runtime in addition",
  },

  // ── Admin: HR — staffing ──────────────────────────────────────────────────
  // Future required permission: hr.staffing
  {
    pattern: "/agent/staffing/requests",
    methods: ["POST"],
    protectionClass: "admin_hr_staffing",
    note: "Create staffing request",
  },
  {
    pattern: "/agent/staffing/requests/*/status",
    methods: ["POST"],
    protectionClass: "admin_hr_staffing",
    note: "Advance staffing request lifecycle",
  },
  {
    pattern: "/agent/staffing/requests/*/fulfill",
    methods: ["POST"],
    protectionClass: "admin_hr_staffing",
    note: "Fulfill staffing request — creates an employee",
  },

  // ── Admin: product / project / deployment ─────────────────────────────────
  // Future required permissions: product.manage, deployment.request, deployment.execute
  {
    pattern: "/agent/intake",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create intake request",
  },
  {
    pattern: "/agent/intake/*/convert-to-project",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Convert intake to project",
  },
  {
    pattern: "/agent/customer-intake",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create customer intake",
  },
  {
    pattern: "/agent/intake/*",
    methods: ["PATCH"],
    protectionClass: "admin_product",
    note: "Update intake status",
  },
  {
    pattern: "/agent/projects",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create project",
  },
  {
    pattern: "/agent/projects/*/task-graph",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create project task graph",
  },
  {
    pattern: "/agent/projects/*/product-execution",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create product execution graph",
  },
  {
    pattern: "/agent/projects/*/interventions",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create product intervention",
  },
  {
    pattern: "/agent/projects/*/lifecycle-actions",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Request product lifecycle action",
  },
  {
    pattern: "/agent/projects/*/lifecycle-actions/execute",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Execute product lifecycle action",
  },
  {
    pattern: "/agent/product-deployments",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create deployment record",
  },
  {
    pattern: "/agent/product-deployments/*/status",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Update deployment status",
  },
  {
    pattern: "/agent/product-deployments/*/execute",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Execute deployment",
  },
  {
    pattern: "/agent/product-signals",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Ingest product signal",
  },
  {
    pattern: "/agent/tasks",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create task directly",
  },
  {
    pattern: "/agent/tasks/*/park",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Park task",
  },
  {
    pattern: "/agent/tasks/*/delegate",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Delegate task",
  },
  {
    pattern: "/agent/tasks/*/artifacts",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create task artifact",
  },
  {
    pattern: "/agent/message-threads",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create message thread",
  },
  {
    pattern: "/agent/messages",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Create canonical message",
  },
  {
    pattern: "/agent/messages/inbound",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Ingest inbound message",
  },
  {
    pattern: "/agent/messages/external-action",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Trigger external action from message",
  },
  {
    pattern: "/agent/message-threads/*/delegate-task",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Delegate task from thread",
  },
  {
    pattern: "/agent/jira/projections",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Jira projection ingest",
  },
  {
    pattern: "/agent/jira/comments",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Jira comment ingest",
  },
  {
    pattern: "/agent/jira/status-signals",
    methods: ["POST"],
    protectionClass: "admin_product",
    note: "Jira status signal ingest",
  },

  // ── Admin: dev/test endpoints ─────────────────────────────────────────────
  // Future required permission: qa.cleanup
  {
    pattern: "/agent/te/seed-approval",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Seed approval for testing",
    currentlyGated: true, // ENABLE_TEST_ENDPOINTS
  },
  {
    pattern: "/agent/te/seed-work-log",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Seed work log for testing",
    currentlyGated: true, // ENABLE_TEST_ENDPOINTS
  },
  {
    pattern: "/agent/work-log/seed",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Seed work log (alias)",
    currentlyGated: true, // ENABLE_TEST_ENDPOINTS
  },
  {
    pattern: "/agent/te/purge-employee",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Purge employee records — NOT currently gated by ENABLE_TEST_ENDPOINTS",
    currentlyGated: false, // gap: needs gating
  },
  {
    pattern: "/agent/te/purge-ci-artifacts",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Purge CI artifact records — gated by cleanup token",
    currentlyGated: true, // cleanup token
  },
  {
    pattern: "/agent/te/purge-projects",
    methods: ["POST"],
    protectionClass: "admin_dev",
    note: "Purge project records — NOT currently gated by ENABLE_TEST_ENDPOINTS",
    currentlyGated: false, // gap: needs gating
  },
];

/** All protection classes that are considered admin-only mutation surfaces. */
export const ADMIN_PROTECTION_CLASSES: RouteProtectionClass[] = [
  "admin_dev",
  "admin_runtime",
  "admin_hr",
  "admin_hr_staffing",
  "admin_governance",
  "admin_product",
];

export function getRoutesByProtectionClass(
  cls: RouteProtectionClass,
): RouteProtectionEntry[] {
  return ROUTE_PROTECTION_MAP.filter((entry) => entry.protectionClass === cls);
}

export function getUngatedAdminRoutes(): RouteProtectionEntry[] {
  return ROUTE_PROTECTION_MAP.filter(
    (entry) =>
      ADMIN_PROTECTION_CLASSES.includes(entry.protectionClass) &&
      entry.currentlyGated === false,
  );
}
