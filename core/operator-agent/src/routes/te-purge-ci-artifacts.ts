import type { OperatorAgentEnv } from "@aep/operator-agent/types";

// Ordered deletion to satisfy foreign-key / logical dependencies.
const PURGE_TABLE_ORDER = [
  "employee_review_evidence_links",
  "employee_performance_reviews",
  "employee_review_cycles",
  "message_mirror_deliveries",
  "external_message_projections",
  "external_thread_projections",
  "external_action_records",
  "external_interaction_audit",
  "thread_external_interaction_policy",
  "employee_messages",
  "message_threads",
  "task_artifacts",
  "task_dependencies",
  "decisions",
  "tasks",
  "projects",
  "intake_requests",
] as const;

type PurgeCiArtifactsBody = {
  runId?: string;
  mode?: "current-run";
};

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
 * Checks whether a table exists in the D1 database schema.
 * Returns false for tables not yet migrated (tolerates partial schema).
 */
async function tableExists(db: D1Database, tableName: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
    )
    .bind(tableName)
    .first<{ name: string }>();
  return row !== null;
}

/**
 * POST /agent/te/purge-ci-artifacts
 *
 * Bounded purge: deletes only rows whose payload contains a __ci marker with the given
 * runId, or whose createdByEmployeeId / requestedBy / createdBy starts with "ci:".
 *
 * Security:
 *   - Requires x-ci-cleanup-token header matching the CI_CLEANUP_TOKEN env var.
 *   - CI_CLEANUP_TOKEN must be non-empty; if unset the endpoint returns 403.
 *   - Not gated on ENABLE_TEST_ENDPOINTS — intentionally available in staging/preview
 *     where the token is provisioned as a Cloudflare secret.
 */
export async function handlePurgeCiArtifacts(
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
        error: "CI artifact purge is not configured on this environment (missing CI_CLEANUP_TOKEN)",
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
  let body: PurgeCiArtifactsBody;
  try {
    body = (await request.json()) as PurgeCiArtifactsBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const runId = body.runId?.trim();
  if (!runId) {
    return Response.json(
      { ok: false, error: "Missing required field: runId" },
      { status: 400 },
    );
  }

  const db = requireDb(env);
  const ciActorPrefix = `ci:%:${runId}`;

  // Count deleted rows per table for the response summary.
  const summary: Record<string, number> = {};

  for (const table of PURGE_TABLE_ORDER) {
    const exists = await tableExists(db, table);
    if (!exists) {
      summary[table] = 0;
      continue;
    }

    // Determine which column(s) to match for CI actor prefix.
    // Fall back to payload JSON marker if no actor column exists.
    let deletedCount = 0;

    if (table === "intake_requests") {
      // No JSON payload column; match on requested_by ci-actor prefix only
      const result = await db
        .prepare(
          `DELETE FROM ${table}
           WHERE requested_by LIKE ?`,
        )
        .bind(ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "employee_review_cycles") {
      // review_cycles uses created_by; no JSON payload column exists
      const result = await db
        .prepare(
          `DELETE FROM ${table}
           WHERE created_by LIKE ? OR created_by LIKE 'ci:%:${runId}'`,
        )
        .bind(ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "employee_review_evidence_links") {
      // Evidence rows are linked by review_id; remove those tied to CI-created reviews.
      const result = await db
        .prepare(
          `DELETE FROM employee_review_evidence_links
           WHERE review_id IN (
             SELECT review_id
             FROM employee_performance_reviews
             WHERE created_by LIKE ?
           )`,
        )
        .bind(ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "employee_performance_reviews") {
      // No payload column; rely on created_by and parent cycle linkage.
      const result = await db
        .prepare(
          `DELETE FROM employee_performance_reviews
           WHERE created_by LIKE ?
              OR review_cycle_id IN (
                SELECT review_cycle_id
                FROM employee_review_cycles
                WHERE created_by LIKE ?
              )`,
        )
        .bind(ciActorPrefix, ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "tasks") {
      // has created_by_employee_id and payload (TEXT JSON)
      const result = await db
        .prepare(
          `DELETE FROM tasks
           WHERE created_by_employee_id LIKE ?
              OR json_extract(payload, '$.__ci.runId') = ?`,
        )
        .bind(ciActorPrefix, runId)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "projects") {
      // No creator or payload column; identify via linked intake_requests.requested_by
      const result = await db
        .prepare(
          `DELETE FROM projects
           WHERE intake_request_id IN (
             SELECT id FROM intake_requests WHERE requested_by LIKE ?
           )`,
        )
        .bind(ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "task_artifacts") {
      // JSON column is content_json (not content)
      const result = await db
        .prepare(
          `DELETE FROM task_artifacts
           WHERE created_by_employee_id LIKE ?
              OR json_extract(content_json, '$.__ci.runId') = ?`,
        )
        .bind(ciActorPrefix, runId)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "message_threads") {
      // No payload column; match on created_by_employee_id only
      const result = await db
        .prepare(
          `DELETE FROM message_threads
           WHERE created_by_employee_id LIKE ?`,
        )
        .bind(ciActorPrefix)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "employee_messages") {
      // JSON column is payload_json (not payload)
      const result = await db
        .prepare(
          `DELETE FROM employee_messages
           WHERE sender_employee_id LIKE ?
              OR json_extract(payload_json, '$.__ci.runId') = ?`,
        )
        .bind(ciActorPrefix, runId)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "task_dependencies") {
      // FK to tasks (task_id, depends_on_task_id) requires deleting dependent edges first.
      const result = await db
        .prepare(
          `DELETE FROM task_dependencies
           WHERE task_id IN (
             SELECT id FROM tasks
             WHERE created_by_employee_id LIKE ?
                OR json_extract(payload, '$.__ci.runId') = ?
           )
              OR depends_on_task_id IN (
                SELECT id FROM tasks
                WHERE created_by_employee_id LIKE ?
                   OR json_extract(payload, '$.__ci.runId') = ?
              )`,
        )
        .bind(ciActorPrefix, runId, ciActorPrefix, runId)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else if (table === "decisions") {
      // FK to tasks(task_id); remove decisions tied to CI-created tasks first.
      const result = await db
        .prepare(
          `DELETE FROM decisions
           WHERE task_id IN (
             SELECT id FROM tasks
             WHERE created_by_employee_id LIKE ?
                OR json_extract(payload, '$.__ci.runId') = ?
           )`,
        )
        .bind(ciActorPrefix, runId)
        .run();
      deletedCount = result.meta?.changes ?? 0;
    } else {
      // For all other tables, attempt a payload JSON match only.
      // Silently skip tables that don't have a payload column.
      try {
        const result = await db
          .prepare(
            `DELETE FROM ${table}
             WHERE json_extract(payload, '$.__ci.runId') = ?
                OR json_extract(content, '$.__ci.runId') = ?`,
          )
          .bind(runId, runId)
          .run();
        deletedCount = result.meta?.changes ?? 0;
      } catch {
        // Table exists but has no payload/content column; skip gracefully.
        deletedCount = 0;
      }
    }

    summary[table] = deletedCount;
  }

  const totalDeleted = Object.values(summary).reduce((a, b) => a + b, 0);

  return Response.json({
    ok: true,
    runId,
    mode: body.mode ?? "current-run",
    totalDeleted,
    summary,
  });
}
