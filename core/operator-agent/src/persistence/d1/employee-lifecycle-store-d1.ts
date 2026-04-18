import type {
  AgentRoleId,
  EmployeeEmploymentEventRecord,
  EmployeeEmploymentEventType,
  EmployeeEmploymentStatus,
  EmployeePublicLink,
  EmployeePublicLinkType,
  OperatorAgentEnv,
  TaskReassignmentReason,
} from "@aep/operator-agent/types";

import {
  listActiveTasksForEmployee,
  reassignTask,
} from "@aep/operator-agent/persistence/d1/task-reassignment-store-d1";

type EmployeeLifecycleRow = {
  id: string;
  company_id: string;
  team_id: string;
  employee_name: string;
  role_id: string;
  status: string;
  employment_status: string;
  scheduler_mode: string;
};

type EmploymentEventRow = {
  event_id: string;
  employee_id: string;
  event_type: EmployeeEmploymentEventType;
  from_team_id?: string | null;
  to_team_id?: string | null;
  from_role_id?: string | null;
  to_role_id?: string | null;
  effective_at: string;
  reason?: string | null;
  approved_by?: string | null;
  thread_id?: string | null;
  created_at?: string | null;
};

type EmployeePersonaRow = {
  bio: string;
  tone: string;
  skills_json: string;
  photo_url?: string | null;
};

type EmployeeVisualIdentityRow = {
  public_appearance_summary?: string | null;
  birth_year?: number | string | null;
  avatar_asset_url?: string | null;
};

export type CreateEmployeeInput = {
  employeeId?: string;
  companyId?: string;
  teamId: string;
  roleId: AgentRoleId;
  employeeName: string;
  runtimeStatus?: "planned" | "active" | "disabled";
  employmentStatus?: EmployeeEmploymentStatus;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
  isSynthetic?: boolean;
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
  reason?: string;
};

export type UpdateEmployeeProfileInput = {
  employeeName?: string;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
};

export type EmployeeLifecycleActionInput = {
  action:
    | "activate"
    | "reassign_team"
    | "change_role"
    | "start_leave"
    | "end_leave"
    | "retire"
    | "terminate"
    | "rehire"
    | "archive";
  toTeamId?: string;
  toRoleId?: AgentRoleId;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function nowIso(input?: string): string {
  return input ?? new Date().toISOString();
}

function normalizePublicLinkType(value: string): EmployeePublicLinkType {
  switch (value) {
    case "github":
    case "linkedin":
    case "website":
    case "x":
    case "portfolio":
      return value;
    default:
      return "website";
  }
}

function rowToEmploymentEvent(
  row: EmploymentEventRow,
): EmployeeEmploymentEventRecord {
  return {
    eventId: row.event_id,
    employeeId: row.employee_id,
    eventType: row.event_type,
    fromTeamId: (row.from_team_id ?? undefined) as EmployeeEmploymentEventRecord["fromTeamId"],
    toTeamId: (row.to_team_id ?? undefined) as EmployeeEmploymentEventRecord["toTeamId"],
    fromRoleId: (row.from_role_id ?? undefined) as EmployeeEmploymentEventRecord["fromRoleId"],
    toRoleId: (row.to_role_id ?? undefined) as EmployeeEmploymentEventRecord["toRoleId"],
    effectiveAt: row.effective_at,
    reason: row.reason ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    threadId: row.thread_id ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

async function getEmployeeRow(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeLifecycleRow | null> {
  const db = requireDb(env);
  return (
    (await db
      .prepare(
        `SELECT
           id,
           company_id,
           team_id,
           employee_name,
           role_id,
           status,
           employment_status,
           scheduler_mode
         FROM employees_catalog
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(employeeId)
      .first<EmployeeLifecycleRow>()) ?? null
  );
}

async function getRoleTeamId(
  env: OperatorAgentEnv,
  roleId: string,
): Promise<string | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT team_id
       FROM roles_catalog
       WHERE role_id = ?
       LIMIT 1`,
    )
    .bind(roleId)
    .first<{ team_id: string }>();

  return row?.team_id ?? null;
}

async function assertTeamExists(env: OperatorAgentEnv, teamId: string): Promise<void> {
  const db = requireDb(env);
  const row = await db
    .prepare(`SELECT id FROM teams WHERE id = ? LIMIT 1`)
    .bind(teamId)
    .first<{ id: string }>();

  if (!row?.id) {
    throw new Error(`Unknown teamId: ${teamId}`);
  }
}

async function assertRoleMatchesTeam(
  env: OperatorAgentEnv,
  roleId: string,
  teamId: string,
): Promise<void> {
  const roleTeamId = await getRoleTeamId(env, roleId);
  if (!roleTeamId) {
    throw new Error(`Unknown roleId: ${roleId}`);
  }

  if (roleTeamId !== teamId) {
    throw new Error(`Role ${roleId} belongs to ${roleTeamId}, not ${teamId}`);
  }
}

async function getEmployeePersonaRow(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeePersonaRow | null> {
  const db = requireDb(env);
  return (
    (await db
      .prepare(
        `SELECT bio, tone, skills_json, photo_url
         FROM employee_personas
         WHERE employee_id = ?
         LIMIT 1`,
      )
      .bind(employeeId)
      .first<EmployeePersonaRow>()) ?? null
  );
}

async function getEmployeeVisualIdentityRow(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeVisualIdentityRow | null> {
  const db = requireDb(env);
  return (
    (await db
      .prepare(
        `SELECT public_appearance_summary, birth_year, avatar_asset_url
         FROM employee_visual_identity
         WHERE employee_id = ?
         LIMIT 1`,
      )
      .bind(employeeId)
      .first<EmployeeVisualIdentityRow>()) ?? null
  );
}

async function replacePublicLinks(
  env: OperatorAgentEnv,
  employeeId: string,
  publicLinks: EmployeePublicLink[],
): Promise<void> {
  const db = requireDb(env);
  await db
    .prepare(`DELETE FROM employee_public_links WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  for (const link of publicLinks) {
    await db
      .prepare(
        `INSERT INTO employee_public_links (
           link_id,
           employee_id,
           link_type,
           url,
           is_verified,
           visibility,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `emplink_${crypto.randomUUID().split("-")[0]}`,
        employeeId,
        normalizePublicLinkType(link.type),
        link.url,
        link.verified ? 1 : 0,
        link.visibility,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }
}

async function upsertPersonaAndVisual(args: {
  env: OperatorAgentEnv;
  employeeId: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
}): Promise<void> {
  const db = requireDb(args.env);
  const hasPersonaData =
    typeof args.bio !== "undefined" ||
    typeof args.tone !== "undefined" ||
    typeof args.skills !== "undefined" ||
    typeof args.avatarUrl !== "undefined";

  if (hasPersonaData) {
    const existingPersona = await getEmployeePersonaRow(args.env, args.employeeId);

    await db
      .prepare(
        `INSERT INTO employee_personas (
           employee_id,
           bio,
           tone,
           skills_json,
           photo_url,
           created_at
         ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(employee_id) DO UPDATE SET
           bio = excluded.bio,
           tone = excluded.tone,
           skills_json = excluded.skills_json,
           photo_url = excluded.photo_url`,
      )
      .bind(
        args.employeeId,
        args.bio ?? existingPersona?.bio ?? "",
        args.tone ?? existingPersona?.tone ?? "",
        JSON.stringify(args.skills ?? JSON.parse(existingPersona?.skills_json ?? "[]")),
        args.avatarUrl ?? existingPersona?.photo_url ?? null,
      )
      .run();
  }

  const hasVisualData =
    typeof args.appearanceSummary !== "undefined" ||
    typeof args.birthYear !== "undefined" ||
    typeof args.avatarUrl !== "undefined";

  if (hasVisualData) {
    const existingVisual = await getEmployeeVisualIdentityRow(args.env, args.employeeId);

    await db
      .prepare(
        `INSERT INTO employee_visual_identity (
           employee_id,
           public_appearance_summary,
           birth_year,
           avatar_asset_url,
           visual_base_prompt,
           portrait_prompt,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(employee_id) DO UPDATE SET
           public_appearance_summary = excluded.public_appearance_summary,
           birth_year = excluded.birth_year,
           avatar_asset_url = excluded.avatar_asset_url,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        args.employeeId,
        args.appearanceSummary ?? existingVisual?.public_appearance_summary ?? null,
        typeof args.birthYear === "number"
          ? args.birthYear
          : typeof existingVisual?.birth_year === "number"
            ? existingVisual.birth_year
            : typeof existingVisual?.birth_year === "string" && existingVisual.birth_year.length > 0
              ? Number.parseInt(existingVisual.birth_year, 10)
              : null,
        args.avatarUrl ?? existingVisual?.avatar_asset_url ?? null,
      )
      .run();
  }
}

async function insertEmploymentEvent(args: {
  env: OperatorAgentEnv;
  employeeId: string;
  eventType: EmployeeEmploymentEventType;
  fromTeamId?: string;
  toTeamId?: string;
  fromRoleId?: string;
  toRoleId?: string;
  effectiveAt?: string;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  eventId?: string;
}): Promise<string> {
  const db = requireDb(args.env);
  const eventId = args.eventId ?? `evt_${crypto.randomUUID().split("-")[0]}`;
  await db
    .prepare(
      `INSERT INTO employee_employment_events (
         event_id,
         employee_id,
         event_type,
         from_team_id,
         to_team_id,
         from_role_id,
         to_role_id,
         effective_at,
         reason,
         approved_by,
         thread_id,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .bind(
      eventId,
      args.employeeId,
      args.eventType,
      args.fromTeamId ?? null,
      args.toTeamId ?? null,
      args.fromRoleId ?? null,
      args.toRoleId ?? null,
      nowIso(args.effectiveAt),
      args.reason ?? null,
      args.approvedBy ?? null,
      args.threadId ?? null,
    )
    .run();

  return eventId;
}

async function findReplacementEmployee(
  env: OperatorAgentEnv,
  teamId: string,
  roleId: string,
  excludeEmployeeId: string,
): Promise<string | null> {
  const db = requireDb(env);

  const sameRole = await db
    .prepare(
      `SELECT id
       FROM employees_catalog
       WHERE team_id = ?
         AND role_id = ?
         AND employment_status = 'active'
         AND id != ?
       LIMIT 1`,
    )
    .bind(teamId, roleId, excludeEmployeeId)
    .first<{ id: string }>();

  if (sameRole?.id) {
    return sameRole.id;
  }

  const sameTeam = await db
    .prepare(
      `SELECT id
       FROM employees_catalog
       WHERE team_id = ?
         AND employment_status = 'active'
         AND id != ?
       LIMIT 1`,
    )
    .bind(teamId, excludeEmployeeId)
    .first<{ id: string }>();

  return sameTeam?.id ?? null;
}

async function handleWorkContinuity(
  env: OperatorAgentEnv,
  employeeId: string,
  teamId: string,
  roleId: string,
  eventType: EmployeeEmploymentEventType,
  eventId: string,
  threadId?: string,
): Promise<void> {
  const tasks = await listActiveTasksForEmployee(env, employeeId);

  if (tasks.length === 0) {
    return;
  }

  const replacement = await findReplacementEmployee(
    env,
    teamId,
    roleId,
    employeeId,
  );

  if (!replacement) {
    return;
  }

  const reason: TaskReassignmentReason =
    eventType === "terminated"
      ? "employee_terminated"
      : eventType === "retired"
        ? "employee_retired"
        : "employee_unavailable";

  for (const taskId of tasks) {
    await reassignTask(env, {
      taskId,
      fromEmployeeId: employeeId,
      toEmployeeId: replacement,
      reason,
      triggeredByEventId: eventId,
      threadId,
    });
  }
}

export async function createEmployee(
  env: OperatorAgentEnv,
  input: CreateEmployeeInput,
): Promise<{ employeeId: string; employmentStatus: EmployeeEmploymentStatus }> {
  const db = requireDb(env);
  const employeeId = input.employeeId ?? `emp_${crypto.randomUUID().split("-")[0]}`;
  const companyId = input.companyId ?? "company_internal_aep";
  const runtimeStatus = input.runtimeStatus ?? "planned";
  const employmentStatus = input.employmentStatus ?? "draft";
  const schedulerMode = input.schedulerMode ?? "manual_only";
  const timestamp = new Date().toISOString();

  await assertTeamExists(env, input.teamId);
  await assertRoleMatchesTeam(env, input.roleId, input.teamId);

  const existing = await getEmployeeRow(env, employeeId);
  if (existing) {
    throw new Error(`Employee already exists: ${employeeId}`);
  }

  await db
    .prepare(
      `INSERT INTO employees_catalog (
         id,
         company_id,
         team_id,
         employee_name,
         role_id,
         status,
         employment_status,
         scheduler_mode,
         is_synthetic,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      employeeId,
      companyId,
      input.teamId,
      input.employeeName,
      input.roleId,
      runtimeStatus,
      employmentStatus,
      schedulerMode,
      input.isSynthetic === true ? 1 : 0,
      timestamp,
      timestamp,
    )
    .run();

  await upsertPersonaAndVisual({
    env,
    employeeId,
    bio: input.bio,
    tone: input.tone,
    skills: input.skills,
    avatarUrl: input.avatarUrl,
    appearanceSummary: input.appearanceSummary,
    birthYear: input.birthYear,
  });

  if (input.publicLinks) {
    await replacePublicLinks(env, employeeId, input.publicLinks);
  }

  await insertEmploymentEvent({
    env,
    employeeId,
    eventType: "hired",
    toTeamId: input.teamId,
    toRoleId: input.roleId,
    effectiveAt: input.effectiveAt,
    reason: input.reason ?? "Employee created",
    approvedBy: input.approvedBy,
    threadId: input.threadId,
  });

  return {
    employeeId,
    employmentStatus,
  };
}

export async function updateEmployeeProfile(
  env: OperatorAgentEnv,
  employeeId: string,
  input: UpdateEmployeeProfileInput,
): Promise<void> {
  const db = requireDb(env);
  const existing = await getEmployeeRow(env, employeeId);
  if (!existing) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  if (
    typeof input.employeeName !== "undefined" ||
    typeof input.schedulerMode !== "undefined"
  ) {
    await db
      .prepare(
        `UPDATE employees_catalog
         SET employee_name = COALESCE(?, employee_name),
             scheduler_mode = COALESCE(?, scheduler_mode),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.employeeName ?? null,
        input.schedulerMode ?? null,
        new Date().toISOString(),
        employeeId,
      )
      .run();
  }

  await upsertPersonaAndVisual({
    env,
    employeeId,
    bio: input.bio,
    tone: input.tone,
    skills: input.skills,
    avatarUrl: input.avatarUrl,
    appearanceSummary: input.appearanceSummary,
    birthYear: input.birthYear,
  });

  if (input.publicLinks) {
    await replacePublicLinks(env, employeeId, input.publicLinks);
  }
}

function assertHighImpactApproval(
  action: EmployeeLifecycleActionInput["action"],
  approvedBy?: string,
): void {
  if (
    ["retire", "terminate", "archive"].includes(action) &&
    (!approvedBy || approvedBy.trim().length === 0)
  ) {
    throw new Error(`approvedBy is required for action=${action}`);
  }
}

function assertLifecycleMutationAllowed(args: {
  action: EmployeeLifecycleActionInput["action"];
  employmentStatus: EmployeeEmploymentStatus;
}): void {
  const status = args.employmentStatus;

  switch (args.action) {
    case "reassign_team":
    case "change_role":
      if (!["draft", "active", "on_leave"].includes(status)) {
        throw new Error(
          `${args.action} is not allowed for employmentStatus=${status}`,
        );
      }
      return;
    case "start_leave":
    case "end_leave":
      if (!["active", "on_leave"].includes(status)) {
        throw new Error(
          `${args.action} is not allowed for employmentStatus=${status}`,
        );
      }
      return;
    case "terminate":
      if (status === "terminated" || status === "archived") {
        throw new Error(
          `${args.action} is not allowed for employmentStatus=${status}`,
        );
      }
      return;
    case "archive":
      if (!["retired", "terminated"].includes(status)) {
        throw new Error(
          `archive is only allowed for retired or terminated employees; got employmentStatus=${status}`,
        );
      }
      return;
    default:
      return;
  }
}

export async function applyEmployeeLifecycleAction(
  env: OperatorAgentEnv,
  employeeId: string,
  input: EmployeeLifecycleActionInput,
): Promise<{
  employeeId: string;
  employmentStatus: EmployeeEmploymentStatus;
  teamId: string;
  roleId: string;
}> {
  const db = requireDb(env);
  const existing = await getEmployeeRow(env, employeeId);
  if (!existing) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  assertHighImpactApproval(input.action, input.approvedBy);
  assertLifecycleMutationAllowed({
    action: input.action,
    employmentStatus: existing.employment_status as EmployeeEmploymentStatus,
  });

  let nextEmploymentStatus = existing.employment_status as EmployeeEmploymentStatus;
  let nextTeamId = existing.team_id;
  let nextRoleId = existing.role_id;
  let eventType: EmployeeEmploymentEventType;

  switch (input.action) {
    case "activate":
      if (existing.employment_status !== "draft") {
        throw new Error("Only draft employees can be activated");
      }
      nextEmploymentStatus = "active";
      eventType = "activated";
      break;
    case "reassign_team":
      if (!input.toTeamId) {
        throw new Error("toTeamId is required for reassign_team");
      }
      await assertTeamExists(env, input.toTeamId);
      await assertRoleMatchesTeam(env, existing.role_id, input.toTeamId);
      nextTeamId = input.toTeamId;
      eventType = "reassigned";
      break;
    case "change_role":
      if (!input.toRoleId) {
        throw new Error("toRoleId is required for change_role");
      }
      nextRoleId = input.toRoleId;
      nextTeamId = (await getRoleTeamId(env, input.toRoleId)) ?? existing.team_id;
      if (!nextTeamId) {
        throw new Error(`Unknown target role: ${input.toRoleId}`);
      }
      eventType = "role_changed";
      break;
    case "start_leave":
      if (existing.employment_status !== "active") {
        throw new Error("Only active employees can start leave");
      }
      nextEmploymentStatus = "on_leave";
      eventType = "went_on_leave";
      break;
    case "end_leave":
      if (existing.employment_status !== "on_leave") {
        throw new Error("Only on_leave employees can end leave");
      }
      nextEmploymentStatus = "active";
      eventType = "returned_from_leave";
      break;
    case "retire":
      if (!["active", "on_leave"].includes(existing.employment_status)) {
        throw new Error("Only active or on_leave employees can retire");
      }
      nextEmploymentStatus = "retired";
      eventType = "retired";
      break;
    case "terminate":
      if (existing.employment_status === "archived") {
        throw new Error("Archived employees cannot be terminated");
      }
      nextEmploymentStatus = "terminated";
      eventType = "terminated";
      break;
    case "rehire":
      if (!["retired", "terminated"].includes(existing.employment_status)) {
        throw new Error("Only retired or terminated employees can be rehired");
      }
      nextEmploymentStatus = "active";
      eventType = "rehired";
      break;
    case "archive":
      if (existing.employment_status === "archived") {
        throw new Error("Employee is already archived");
      }
      nextEmploymentStatus = "archived";
      eventType = "archived";
      break;
  }

  await db
    .prepare(
      `UPDATE employees_catalog
       SET team_id = ?,
           role_id = ?,
           employment_status = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      nextTeamId,
      nextRoleId,
      nextEmploymentStatus,
      new Date().toISOString(),
      employeeId,
    )
    .run();

  const eventId = await insertEmploymentEvent({
    env,
    employeeId,
    eventType,
    fromTeamId: existing.team_id,
    toTeamId: nextTeamId,
    fromRoleId: existing.role_id,
    toRoleId: nextRoleId,
    effectiveAt: input.effectiveAt,
    reason: input.reason,
    approvedBy: input.approvedBy,
    threadId: input.threadId,
  });

  if (
    eventType === "went_on_leave" ||
    eventType === "terminated" ||
    eventType === "retired"
  ) {
    await handleWorkContinuity(
      env,
      employeeId,
      existing.team_id,
      existing.role_id,
      eventType,
      eventId,
      input.threadId,
    );
  }

  return {
    employeeId,
    employmentStatus: nextEmploymentStatus,
    teamId: nextTeamId,
    roleId: nextRoleId,
  };
}

export async function listEmployeeEmploymentEvents(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeEmploymentEventRecord[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT
         event_id,
         employee_id,
         event_type,
         from_team_id,
         to_team_id,
         from_role_id,
         to_role_id,
         effective_at,
         reason,
         approved_by,
         thread_id,
         created_at
       FROM employee_employment_events
       WHERE employee_id = ?
       ORDER BY effective_at DESC, created_at DESC`,
    )
    .bind(employeeId)
    .all<EmploymentEventRow>();

  return (rows.results ?? []).map(rowToEmploymentEvent);
}