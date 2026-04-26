/* eslint-disable no-console */

/**
 * cleanup-canonical-artifacts.ts
 *
 * CLI tool for purging canonical CI artifacts created by live scenario checks.
 * Calls POST /agent/te/purge-ci-artifacts on the operator-agent.
 *
 * Usage:
 *   tsx scripts/ci/checks/scenarios/cleanup-canonical-artifacts.ts \
 *     --run-id <id> \
 *     --mode current-run
 */

import { parseArgs } from "node:util";

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "run-id": { type: "string" },
      mode: { type: "string", default: "current-run" },
    },
  });

  const runId =
    values["run-id"] ??
    process.env.CI_RUN_ID ??
    process.env.GITHUB_RUN_ID ??
    "local";

  const mode = values.mode ?? "current-run";

  const baseUrl = (
    process.env.OPERATOR_AGENT_BASE_URL ?? ""
  ).replace(/\/$/, "");

  if (!baseUrl) {
    console.error(
      "OPERATOR_AGENT_BASE_URL is required for cleanup-canonical-artifacts",
    );
    process.exit(1);
  }

  const token = process.env.CI_CLEANUP_TOKEN;
  if (!token) {
    console.error("CI_CLEANUP_TOKEN is required for cleanup-canonical-artifacts");
    process.exit(1);
  }

  const url = `${baseUrl}/agent/te/purge-ci-artifacts`;

  console.log(`[cleanup-canonical-artifacts] Purging CI artifacts for run ${runId} (mode: ${mode})`);
  console.log(`[cleanup-canonical-artifacts] Target: ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ci-cleanup-token": token,
    },
    body: JSON.stringify({ runId, mode }),
  });

  const body = await response.json() as Record<string, unknown>;

  if (!response.ok || body.ok !== true) {
    console.error(
      `[cleanup-canonical-artifacts] Purge failed (HTTP ${response.status}): ${JSON.stringify(body)}`,
    );
    process.exit(1);
  }

  console.log(`[cleanup-canonical-artifacts] Purge succeeded:`, JSON.stringify(body, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("[cleanup-canonical-artifacts] Unexpected failure:", error);
  process.exit(1);
});
