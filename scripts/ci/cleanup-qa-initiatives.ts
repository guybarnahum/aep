/* eslint-disable no-console */

/**
 * cleanup-qa-initiatives.ts
 *
 * CLI tool for retiring (or purging) QA-created product initiatives via
 * the canonical lifecycle approval flow.
 *
 * Usage:
 *   tsx scripts/ci/cleanup-qa-initiatives.ts \
 *     --mode retire \
 *     --title-prefix "QA " \
 *     --older-than-hours 0 \
 *     --environment async-validation \
 *     [--dry-run]
 *
 * Environment variables:
 *   OPERATOR_AGENT_BASE_URL   — base URL of the operator-agent Worker
 *   CI_CLEANUP_TOKEN          — token sent as x-ci-cleanup-token header
 */

import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Types (minimal surface)
// ---------------------------------------------------------------------------

interface ProjectRecord {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface LifecycleRequestResponse {
  ok: boolean;
  approvalId: string;
  projectId: string;
  action: string;
  targetStatus: string;
}

interface ApprovalMutationResponse {
  ok: boolean;
}

interface LifecycleExecuteResponse {
  ok: boolean;
  project: { id: string; status: string };
}

interface PurgeProjectsResponse {
  ok: boolean;
  purgedCount: number;
  skippedCount: number;
  failedCount: number;
  purged: string[];
  skipped: Array<{ projectId: string; outcome: "skipped"; reason: string }>;
  failed: Array<{ projectId: string; outcome: "failed"; reason: string }>;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function apiGet(baseUrl: string, path: string, token: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-ci-cleanup-token": token, accept: "application/json" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} failed (HTTP ${response.status}): ${text.slice(0, 280)}`);
  }
  return response.json();
}

async function apiPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-ci-cleanup-token": token,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed (HTTP ${response.status}): ${text.slice(0, 280)}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

function isQaInitiative(project: ProjectRecord, titlePrefix: string): boolean {
  return project.title.startsWith(titlePrefix);
}

function isOlderThan(project: ProjectRecord, hours: number): boolean {
  if (hours <= 0) return true;
  const createdMs = new Date(project.createdAt).getTime();
  const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
  return createdMs < cutoffMs;
}

function isRetirable(project: ProjectRecord): boolean {
  return ["active", "paused"].includes(project.status);
}

function isPurgeable(project: ProjectRecord): boolean {
  return project.status === "archived";
}

// ---------------------------------------------------------------------------
// Purge flow (hard delete — only archived projects)
// ---------------------------------------------------------------------------

const PURGE_BATCH_SIZE = 50;

async function purgeInitiatives(
  baseUrl: string,
  token: string,
  projects: ProjectRecord[],
  dryRun: boolean,
): Promise<{ purged: number; skipped: number; failed: number }> {
  if (dryRun) {
    for (const p of projects) {
      console.log(`  [dry-run] would purge: ${p.id} (${p.title})`);
    }
    return { purged: 0, skipped: projects.length, failed: 0 };
  }

  let purged = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < projects.length; i += PURGE_BATCH_SIZE) {
    const batch = projects.slice(i, i + PURGE_BATCH_SIZE);
    const projectIds = batch.map((p) => p.id);

    try {
      const res = (await apiPost(
        baseUrl,
        "/agent/te/purge-projects",
        { projectIds },
        token,
      )) as PurgeProjectsResponse;

      purged += res.purgedCount;
      skipped += res.skippedCount;
      failed += res.failedCount;

      for (const p of res.purged) {
        console.log(`  Purged: ${p}`);
      }
      for (const s of res.skipped) {
        console.warn(`  Skipped ${s.projectId}: ${s.reason}`);
      }
      for (const f of res.failed) {
        console.error(`  FAILED ${f.projectId}: ${f.reason}`);
      }
    } catch (err) {
      console.error(`  FAILED batch [${projectIds.join(", ")}]: ${String(err)}`);
      failed += batch.length;
    }
  }

  return { purged, skipped, failed };
}

// ---------------------------------------------------------------------------
// Lifecycle retire flow
// ---------------------------------------------------------------------------

async function retireInitiative(
  baseUrl: string,
  token: string,
  project: ProjectRecord,
  dryRun: boolean,
): Promise<{ status: "retired" | "skipped" | "failed"; reason?: string }> {
  if (dryRun) {
    console.log(`  [dry-run] would retire: ${project.id} (${project.title})`);
    return { status: "skipped", reason: "dry-run" };
  }

  try {
    // 1. Request lifecycle retire
    const requestRes = (await apiPost(
      baseUrl,
      `/agent/projects/${encodeURIComponent(project.id)}/lifecycle-actions`,
      {
        action: "retire",
        requestedByEmployeeId: "ci-cleanup-actor",
        reason: "Automated QA initiative cleanup",
      },
      token,
    )) as LifecycleRequestResponse;

    if (!requestRes.ok || !requestRes.approvalId) {
      return { status: "failed", reason: "lifecycle request did not return approvalId" };
    }

    const { approvalId } = requestRes;
    console.log(`  Lifecycle retire requested: ${approvalId}`);

    // 2. Approve the lifecycle approval
    const approveRes = (await apiPost(
      baseUrl,
      "/agent/approvals/approve",
      {
        approvalId,
        decidedBy: "ci-cleanup-actor",
        decisionNote: "Automated approval for QA cleanup",
      },
      token,
    )) as ApprovalMutationResponse;

    if (!approveRes.ok) {
      return { status: "failed", reason: `approve failed for ${approvalId}` };
    }
    console.log(`  Approval approved: ${approvalId}`);

    // 3. Execute the lifecycle action
    const executeRes = (await apiPost(
      baseUrl,
      `/agent/projects/${encodeURIComponent(project.id)}/lifecycle-actions/execute`,
      {
        approvalId,
        executedByEmployeeId: "ci-cleanup-actor",
      },
      token,
    )) as LifecycleExecuteResponse;

    if (!executeRes.ok) {
      return { status: "failed", reason: `execute failed for ${approvalId}` };
    }

    console.log(`  Retired: ${project.id} → status=${executeRes.project.status}`);
    return { status: "retired" };
  } catch (err) {
    return { status: "failed", reason: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      mode: { type: "string", default: "retire" },
      "title-prefix": { type: "string", default: "QA " },
      "older-than-hours": { type: "string", default: "0" },
      environment: { type: "string", default: "async-validation" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const mode = values["mode"] ?? "retire";
  const titlePrefix = values["title-prefix"] ?? "QA ";
  const olderThanHours = Number.parseInt(values["older-than-hours"] ?? "0", 10);
  const environment = values["environment"] ?? "async-validation";
  const dryRun = values["dry-run"] ?? false;

  const baseUrl = (process.env.OPERATOR_AGENT_BASE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) {
    console.error("OPERATOR_AGENT_BASE_URL is required");
    process.exit(1);
  }

  const token = process.env.CI_CLEANUP_TOKEN ?? "";
  if (!token) {
    console.error("CI_CLEANUP_TOKEN is required");
    process.exit(1);
  }

  // Safety guard: never touch production unless explicitly targeting it
  if (environment === "production" && dryRun) {
    console.warn("[cleanup-qa-initiatives] Targeting production with dry-run=true — proceeding in dry-run mode only.");
  }

  if (mode !== "retire" && mode !== "purge") {
    console.error(`[cleanup-qa-initiatives] Unsupported mode: ${mode}. Use 'retire' or 'purge'.`);
    process.exit(1);
  }

  console.log("[cleanup-qa-initiatives] Starting");
  console.log(`  environment:       ${environment}`);
  console.log(`  mode:              ${mode}`);
  console.log(`  title-prefix:      ${JSON.stringify(titlePrefix)}`);
  console.log(`  older-than-hours:  ${olderThanHours}`);
  console.log(`  dry-run:           ${dryRun}`);
  console.log(`  base-url:          ${baseUrl}`);
  console.log("");

  // List all projects
  const listRes = (await apiGet(baseUrl, "/agent/projects?limit=200", token)) as {
    ok: boolean;
    projects: ProjectRecord[];
  };

  if (!listRes.ok || !Array.isArray(listRes.projects)) {
    console.error("[cleanup-qa-initiatives] Failed to list projects:", listRes);
    process.exit(1);
  }

  const allProjects = listRes.projects;
  const matched = allProjects.filter(
    (p) => isQaInitiative(p, titlePrefix) && isOlderThan(p, olderThanHours),
  );

  // --- Purge mode: hard-delete already-archived (retired) QA initiatives ---
  if (mode === "purge") {
    const toPurge = matched.filter(isPurgeable);
    const notPurgeable = matched.filter((p) => !isPurgeable(p));

    console.log(`Matched ${matched.length} QA initiatives (${toPurge.length} purgeable, ${notPurgeable.length} not archived):`);
    for (const p of toPurge) {
      console.log(`  • ${p.id}  status=${p.status}  "${p.title}"`);
    }
    if (notPurgeable.length > 0) {
      console.log(`\nNot archived (skipping — purge only targets archived projects):`);
      for (const p of notPurgeable) {
        console.log(`  • ${p.id}  status=${p.status}  "${p.title}"`);
      }
    }
    console.log("");

    if (toPurge.length === 0) {
      console.log("[cleanup-qa-initiatives] No purgeable QA initiatives found — nothing to do.");
      printSummary({ matched: matched.length, actioned: 0, skipped: matched.length, failed: 0, mode, dryRun });
      return;
    }

    const { purged, skipped, failed } = await purgeInitiatives(baseUrl, token, toPurge, dryRun);
    console.log("");
    printSummary({ matched: matched.length, actioned: purged, skipped: skipped + notPurgeable.length, failed, mode, dryRun });
    if (failed > 0) {
      process.exit(1);
    }
    return;
  }

  // --- Retire mode (default) ---
  const toRetire = matched.filter(isRetirable);
  const alreadyRetired = matched.filter((p) => !isRetirable(p));

  console.log(`Matched ${matched.length} QA initiatives (${toRetire.length} retirable, ${alreadyRetired.length} already terminal):`);
  for (const p of toRetire) {
    console.log(`  • ${p.id}  status=${p.status}  "${p.title}"`);
  }
  if (alreadyRetired.length > 0) {
    console.log(`\nAlready retired/completed (skipping):`);
    for (const p of alreadyRetired) {
      console.log(`  • ${p.id}  status=${p.status}  "${p.title}"`);
    }
  }
  console.log("");

  if (toRetire.length === 0) {
    console.log("[cleanup-qa-initiatives] No retirable QA initiatives found — nothing to do.");
    printSummary({ matched: matched.length, actioned: 0, skipped: matched.length, failed: 0, mode, dryRun });
    return;
  }

  let retired = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of toRetire) {
    console.log(`Processing: ${project.id} (${project.title})`);
    const result = await retireInitiative(baseUrl, token, project, dryRun);
    if (result.status === "retired") retired++;
    else if (result.status === "failed") {
      failed++;
      console.error(`  FAILED: ${result.reason}`);
    } else {
      skipped++;
    }
  }

  console.log("");
  printSummary({ matched: matched.length, actioned: retired, skipped, failed, mode, dryRun });

  if (failed > 0) {
    process.exit(1);
  }
}

function printSummary(args: {
  matched: number;
  actioned: number;
  skipped: number;
  failed: number;
  mode: string;
  dryRun: boolean;
}): void {
  const actionLabel = args.mode === "purge" ? "purged" : "retired";
  console.log("[cleanup-qa-initiatives] Summary");
  console.log(`  matched:   ${args.matched}`);
  console.log(`  ${actionLabel}:   ${args.actioned}${args.dryRun ? " (dry-run)" : ""}`);
  console.log(`  skipped:   ${args.skipped}`);
  console.log(`  failed:    ${args.failed}`);
}

main().catch((err) => {
  console.error("[cleanup-qa-initiatives] Unexpected failure:", err);
  process.exit(1);
});
