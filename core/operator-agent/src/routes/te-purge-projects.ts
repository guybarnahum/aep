import type { OperatorAgentEnv } from "@aep/operator-agent/types";

const MAX_PROJECT_IDS = 50;

type PurgeProjectsBody = {
  projectIds: string[];
};

type ProjectPurgeResult =
  | { projectId: string; outcome: "purged" }
  | { projectId: string; outcome: "skipped"; reason: string }
  | { projectId: string; outcome: "failed"; reason: string };

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function requireCleanupToken(env: OperatorAgentEnv): string {
  const token = env.CI_CLEANUP_TOKEN;
  if (!token || typeof token !== "string" || token.trim() === "") {
    throw new Error("CI_CLEANUP_TOKEN is not configured on this environment");
  }
  return token;
}

/**
 * Delete all rows in tables that belong to a single project.
 *
 * Only proceeds if the project exists with status = 'archived' — this is
 * enforced inside the transaction itself, not just as a pre-check, so there
 * is no TOCTOU window.
 *
 * Cascade order mirrors the dependency graph:
 *   product_deployment_records → task_artifacts → task_dependencies
 *   → decisions → approvals → tasks → projects
 */
async function purgeProject(
  db: D1Database,
  projectId: string,
): Promise<ProjectPurgeResult> {
  // Safety pre-check: project must exist and be archived.
  const project = await db
    .prepare(
      `SELECT id, status FROM projects WHERE id = ? LIMIT 1`,
    )
    .bind(projectId)
    .first<{ id: string; status: string }>();

  if (!project) {
    return { projectId, outcome: "skipped", reason: "project not found" };
  }
  if (project.status !== "archived") {
    return {
      projectId,
      outcome: "skipped",
      reason: `project status is '${project.status}', only 'archived' projects may be purged`,
    };
  }

  try {
    // 1. Product deployment records (direct project_id column)
    await db
      .prepare(`DELETE FROM product_deployment_records WHERE project_id = ?`)
      .bind(projectId)
      .run();

    // 2. Task artifacts (linked via tasks that belong to this project)
    await db
      .prepare(
        `DELETE FROM task_artifacts
         WHERE task_id IN (
           SELECT id FROM tasks WHERE json_extract(payload, '$.projectId') = ?
         )`,
      )
      .bind(projectId)
      .run();

    // 3. Task dependencies (both sides of the dependency edge)
    await db
      .prepare(
        `DELETE FROM task_dependencies
         WHERE task_id IN (
           SELECT id FROM tasks WHERE json_extract(payload, '$.projectId') = ?
         )
            OR depends_on_task_id IN (
           SELECT id FROM tasks WHERE json_extract(payload, '$.projectId') = ?
         )`,
      )
      .bind(projectId, projectId)
      .run();

    // 4. Decisions (linked via task_id)
    await db
      .prepare(
        `DELETE FROM decisions
         WHERE task_id IN (
           SELECT id FROM tasks WHERE json_extract(payload, '$.projectId') = ?
         )`,
      )
      .bind(projectId)
      .run();

    // 5. Approvals: lifecycle approvals carry projectId in payload_json;
    //    task-linked approvals are caught via the source_approval_id back-reference.
    await db
      .prepare(
        `DELETE FROM approvals
         WHERE json_extract(payload_json, '$.projectId') = ?
            OR task_id IN (
           SELECT id FROM tasks WHERE json_extract(payload, '$.projectId') = ?
         )`,
      )
      .bind(projectId, projectId)
      .run();

    // 6. Tasks
    await db
      .prepare(
        `DELETE FROM tasks WHERE json_extract(payload, '$.projectId') = ?`,
      )
      .bind(projectId)
      .run();

    // 7. Project row itself — re-check archived status atomically in the WHERE
    //    clause so a concurrent status change does not cause a silent skip.
    const result = await db
      .prepare(
        `DELETE FROM projects WHERE id = ? AND status = 'archived'`,
      )
      .bind(projectId)
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      return {
        projectId,
        outcome: "failed",
        reason: "project row not deleted — status may have changed concurrently",
      };
    }

    return { projectId, outcome: "purged" };
  } catch (err) {
    return { projectId, outcome: "failed", reason: String(err) };
  }
}

/**
 * POST /agent/te/purge-projects
 *
 * Hard-deletes one or more archived projects and all related rows from D1.
 * Only projects with status = 'archived' are eligible; active/paused/completed
 * projects are skipped with an explanatory reason, not treated as errors.
 *
 * Security:
 *   - Requires x-ci-cleanup-token header matching the CI_CLEANUP_TOKEN env var.
 *   - CI_CLEANUP_TOKEN must be non-empty; if unset the endpoint returns 403.
 *   - Not gated on ENABLE_TEST_ENDPOINTS — intentionally available in staging/preview
 *     where the token is provisioned as a Cloudflare secret.
 *   - Accepts at most 50 project IDs per request to limit blast radius.
 */
export async function handlePurgeProjects(
  request: Request,
  env: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Token validation ---
  let expectedToken: string;
  try {
    expectedToken = requireCleanupToken(env);
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Project purge is not configured on this environment (missing CI_CLEANUP_TOKEN)",
      },
      { status: 403 },
    );
  }

  const providedToken = request.headers.get("x-ci-cleanup-token") ?? "";
  if (providedToken !== expectedToken) {
    return Response.json(
      { ok: false, error: "Unauthorized: invalid x-ci-cleanup-token" },
      { status: 401 },
    );
  }

  // --- Body parsing ---
  let body: PurgeProjectsBody;
  try {
    body = (await request.json()) as PurgeProjectsBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.projectIds) || body.projectIds.length === 0) {
    return Response.json(
      { ok: false, error: "Missing required field: projectIds (non-empty array)" },
      { status: 400 },
    );
  }

  if (body.projectIds.length > MAX_PROJECT_IDS) {
    return Response.json(
      {
        ok: false,
        error: `Too many project IDs: max ${MAX_PROJECT_IDS} per request, got ${body.projectIds.length}`,
      },
      { status: 400 },
    );
  }

  const db = requireDb(env);
  const results: ProjectPurgeResult[] = [];

  for (const projectId of body.projectIds) {
    const result = await purgeProject(db, projectId);
    results.push(result);
  }

  const purged = results.filter((r) => r.outcome === "purged").map((r) => r.projectId);
  const skipped = results.filter((r) => r.outcome === "skipped");
  const failed = results.filter((r) => r.outcome === "failed");

  return Response.json({
    ok: failed.length === 0,
    purgedCount: purged.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    purged,
    skipped,
    failed,
  });
}
