#!/usr/bin/env node

import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";

export {};

type RunResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
};

function parseArgs(argv: string[]) {
  if (argv.length >= 2 && !argv[0].startsWith("--")) {
    return {
      operatorBaseUrl: argv[0].replace(/\/+$/, ""),
      taskId: argv[1],
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
    process.env.TASK_ID ??
    process.env.WORK_ORDER_ID;

  if (!taskId) {
    throw new Error("Missing required task id");
  }

  return {
    operatorBaseUrl: operatorBaseUrl.replace(/\/+$/, ""),
    taskId,
  } as const;
}

async function main() {
  const { operatorBaseUrl, taskId } = parseArgs(process.argv.slice(2));
  const reliabilityEngineerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl: operatorBaseUrl,
    roleId: "reliability-engineer",
    teamId: "team_validation",
    runtimeStatus: "implemented",
  });

  console.log(`Executing validation task ${taskId}...`);

  const body = (await fetch(`${operatorBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "github-actions-post-deploy",
    },
    body: JSON.stringify({
      companyId: "company_internal_aep",
      teamId: "team_validation",
      employeeId: reliabilityEngineerEmployeeId,
      roleId: "reliability-engineer",
      taskId,
      trigger: "manual",
      policyVersion: "ci-post-deploy",
    }),
  }).then(async (response) => {
    const text = await response.text();
    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    if (!response.ok) {
      throw new Error(
        `POST /agent/run failed with ${response.status} ${response.statusText}: ${text.replace(/\s+/g, " ").trim()}`,
      );
    }

    if (!contentType.includes("application/json")) {
      throw new Error(
        `POST /agent/run returned non-JSON content-type: ${contentType || "<missing>"}`,
      );
    }

    return JSON.parse(text) as Promise<RunResponse>;
  })) as RunResponse;

  if (!body.ok) {
    throw new Error(
      `Failed to execute validation task: ${body.error ?? body.status ?? "unknown error"}`,
    );
  }

  console.log(`EXECUTED_TASK_ID=${taskId}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Execution failed: ${message}`);
  process.exit(1);
});