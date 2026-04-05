#!/usr/bin/env node

import { fetchJson } from "../lib/http-json";

export {};

type TaskResponse = {
  ok: boolean;
  task?: {
    id: string;
    status: "pending" | "in-progress" | "completed" | "failed";
  };
  decision?: {
    verdict?: string;
    reasoning?: string;
  } | null;
};

function parseArgs(argv: string[]) {
  if (argv.length >= 2 && !argv[0].startsWith("--")) {
    return {
      operatorBaseUrl: argv[0].replace(/\/+$/, ""),
      workOrderId: argv[1],
      attempts: 20,
      intervalMs: 10_000,
    } as const;
  }

  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    i += 1;
  }

  const operatorBaseUrl =
    args.get("operator-base-url") ?? args.get("base-url") ?? process.env.OPERATOR_AGENT_BASE_URL;
  if (!operatorBaseUrl) {
    throw new Error("Missing required operator-agent base URL");
  }

  const workOrderId = args.get("work-order-id") ?? args.get("dispatch-batch-id");
  if (!workOrderId) {
    throw new Error("Missing required work order id");
  }

  const attempts = Number(args.get("attempts") ?? 20);
  const intervalMs = Number(args.get("interval-ms") ?? 10_000);
  if (!Number.isFinite(attempts) || attempts <= 0) {
    throw new Error("Invalid --attempts, must be a positive number");
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Invalid --interval-ms, must be a positive number");
  }

  return {
    operatorBaseUrl: operatorBaseUrl.replace(/\/+$/, ""),
    workOrderId,
    attempts: Math.trunc(attempts),
    intervalMs: Math.trunc(intervalMs),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { operatorBaseUrl, workOrderId, attempts, intervalMs } = parseArgs(
    process.argv.slice(2),
  );

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = (await fetchJson(
      operatorBaseUrl,
      `/agent/tasks/${encodeURIComponent(workOrderId)}`,
    )) as TaskResponse;

    if (!response.ok || !response.task) {
      throw new Error(`Failed to fetch task ${workOrderId}`);
    }

    if (response.task.status === "completed") {
      const verdict = String(response.decision?.verdict ?? "unknown").toUpperCase();
      const reasoning = String(response.decision?.reasoning ?? "<missing>");

      console.log(`Reliability Engineer verdict: ${verdict}`);
      console.log(`Reasoning: ${reasoning}`);
      process.exit(response.decision?.verdict === "pass" ? 0 : 1);
    }

    if (response.task.status === "failed") {
      console.error("Validation task execution failed.");
      process.exit(1);
    }

    console.log(`... Waiting for Reliability Engineer (status: ${response.task.status}) ...`);
    await sleep(intervalMs);
  }

  console.error("Timeout waiting for validation verdict.");
  process.exit(1);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});