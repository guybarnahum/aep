#!/usr/bin/env node

import { fetchJson } from "../lib/http-json";
import { poll } from "./tasks/poll";

export {};

type TaskResponse = {
  ok: boolean;
  task?: {
    id: string;
    status:
      | "queued"
      | "blocked"
      | "ready"
      | "in_progress"
      | "completed"
      | "failed"
      | "escalated";
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
      taskId: argv[1],
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
    args.get("operator-base-url") ??
    args.get("base-url") ??
    process.env.OPERATOR_AGENT_BASE_URL;
  if (!operatorBaseUrl) {
    throw new Error("Missing required operator-agent base URL");
  }

  const taskId =
    args.get("task-id") ??
    args.get("work-order-id") ??
    args.get("dispatch-batch-id") ??
    process.env.TASK_ID ??
    process.env.WORK_ORDER_ID;

  if (!taskId) {
    throw new Error("Missing required task id");
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
    taskId,
    attempts: Math.trunc(attempts),
    intervalMs: Math.trunc(intervalMs),
  };
}

async function main() {
  const { operatorBaseUrl, taskId, attempts, intervalMs } = parseArgs(
    process.argv.slice(2),
  );

  const response = await poll(
    async () => {
      const current = (await fetchJson(
        operatorBaseUrl,
        `/agent/tasks/${encodeURIComponent(taskId)}`,
      )) as TaskResponse;

      if (!current.ok || !current.task) {
        throw new Error(`Failed to fetch task ${taskId}`);
      }

      if (
        current.task.status !== "completed" &&
        current.task.status !== "failed" &&
        current.task.status !== "escalated"
      ) {
        console.log(
          `... Waiting for Reliability Engineer (status: ${current.task.status}) ...`,
        );
      }

      return current;
    },
    {
      label: "check-validation-verdict",
      intervalMs,
      timeoutMs: attempts * intervalMs,
      shouldStop: (current) =>
        !!current.task &&
        (current.task.status === "completed" ||
          current.task.status === "failed" ||
          current.task.status === "escalated"),
    },
  );

  if (!response.task) {
    throw new Error(`Failed to fetch task ${taskId}`);
  }

  if (response.task.status === "completed") {
    const verdict = String(response.decision?.verdict ?? "unknown").toUpperCase();
    const reasoning = String(response.decision?.reasoning ?? "<missing>");

    console.log(`Reliability Engineer verdict: ${verdict}`);
    console.log(`Reasoning: ${reasoning}`);
    process.exit(response.decision?.verdict === "pass" ? 0 : 1);
  }

  if (
    response.task.status === "failed" ||
    response.task.status === "escalated"
  ) {
    console.error(`Validation task ended in terminal status: ${response.task.status}`);
    process.exit(1);
  }

  console.error("Timeout waiting for validation verdict.");
  process.exit(1);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});