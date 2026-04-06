#!/usr/bin/env node

import { httpPost } from "../lib/http-json";

export {};

function parseArgs(argv: string[]) {
  if (argv.length >= 2 && !argv[0].startsWith("--")) {
    return {
      operatorBaseUrl: argv[0].replace(/\/+$/, ""),
      targetUrl: argv[1],
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

  const targetUrl = args.get("target-url") ?? process.env.DEPLOY_URL;
  if (!targetUrl) {
    throw new Error("Missing required target URL");
  }

  return {
    operatorBaseUrl: operatorBaseUrl.replace(/\/+$/, ""),
    targetUrl,
  } as const;
}

async function main() {
  const { operatorBaseUrl, targetUrl } = parseArgs(
    process.argv.slice(2),
  );

  console.log(`Dispatching validation task for ${targetUrl}...`);

  const body = (await httpPost(`${operatorBaseUrl}/agent/tasks`, {
    companyId: "company_internal_aep",
    teamId: "team_validation",
    taskType: "validate-deployment",
    payload: {
      targetUrl,
      useControlPlaneBinding: true,
    },
  })) as { ok?: boolean; workOrderId?: string; error?: string };

  if (!body.ok || typeof body.workOrderId !== "string" || body.workOrderId.length === 0) {
    throw new Error(`Failed to create task: ${body.error ?? "missing workOrderId"}`);
  }

  console.log(`WORK_ORDER_ID=${body.workOrderId}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Execution failed: ${message}`);
  process.exit(1);
});