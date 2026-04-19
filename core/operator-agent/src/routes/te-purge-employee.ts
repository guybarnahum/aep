import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { getConfig } from "@aep/operator-agent/config";

type PurgeEmployeeBody = {
  employeeId?: string;
};

type EmployeePurgeRow = {
  id: string;
  employee_name: string;
  employment_status: string;
  is_synthetic?: number | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function hasAuthorizedCleanupAccess(
  request: Request,
  env: OperatorAgentEnv,
): boolean {
  if (env.ENABLE_TEST_ENDPOINTS === "true") {
    return true;
  }

  const config = getConfig(env);
  if (!config.syntheticEmployeeCleanupToken) {
    return false;
  }

  const providedToken =
    request.headers.get("x-aep-cleanup-token")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";

  return (
    providedToken.length > 0 &&
    providedToken === config.syntheticEmployeeCleanupToken
  );
}

export async function handlePurgeEmployee(
  request: Request,
  env: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!hasAuthorizedCleanupAccess(request, env)) {
    return Response.json(
      {
        ok: false,
        error:
          "Synthetic employee purge requires ENABLE_TEST_ENDPOINTS=true or a valid cleanup token",
      },
      { status: 403 },
    );
  }

  let body: PurgeEmployeeBody;
  try {
    body = (await request.json()) as PurgeEmployeeBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const employeeId = body.employeeId?.trim();
  if (!employeeId) {
    return Response.json(
      { ok: false, error: "Missing required field: employeeId" },
      { status: 400 },
    );
  }

  const db = requireDb(env);
  const employee = await db
    .prepare(
      `SELECT id, employee_name, employment_status, is_synthetic
       FROM employees_catalog
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(employeeId)
    .first<EmployeePurgeRow>();

  if (!employee) {
    return Response.json(
      { ok: false, error: `Employee not found: ${employeeId}` },
      { status: 404 },
    );
  }

  if (employee.is_synthetic !== 1) {
    return Response.json(
      { ok: false, error: `Refusing to purge non-synthetic employee ${employeeId}` },
      { status: 400 },
    );
  }

  if (employee.employment_status !== "archived") {
    return Response.json(
      {
        ok: false,
        error: `Refusing to purge employee ${employeeId} unless employment_status=archived`,
      },
      { status: 400 },
    );
  }

  // Future tightening:
  // - require an internal admin policy decision in canonical state
  // - optionally scope cleanup token usage to specific environments or callers

  await db
    .prepare(
      `DELETE FROM employee_review_evidence_links
       WHERE review_id IN (
         SELECT review_id
         FROM employee_performance_reviews
         WHERE employee_id = ?
       )`,
    )
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_performance_reviews WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_prompt_profiles WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_public_links WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_visual_identity WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_personas WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_employment_events WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employee_scope_bindings WHERE employee_id = ?`)
    .bind(employeeId)
    .run();

  await db
    .prepare(
      `DELETE FROM task_reassignments
       WHERE from_employee_id = ? OR to_employee_id = ?`,
    )
    .bind(employeeId, employeeId)
    .run();

  await db
    .prepare(`DELETE FROM employees_catalog WHERE id = ?`)
    .bind(employeeId)
    .run();

  return Response.json({
    ok: true,
    employeeId,
    employeeName: employee.employee_name,
    employmentStatus: employee.employment_status,
    purged: true,
  });
}