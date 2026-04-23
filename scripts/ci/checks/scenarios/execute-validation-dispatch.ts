#!/usr/bin/env node

import { httpPost } from "../../../lib/http-json";
import { retry } from "../../tasks/retry";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";

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
    args.get("operator-base-url") ??
    args.get("base-url") ??
    process.env.OPERATOR_AGENT_BASE_URL;
  if (!operatorBaseUrl) {
    throw new Error("Missing required operator-agent base URL");
  }

  const targetUrl = args.get("target-url") ?? process.env.CONTROL_PLANE_BASE_URL;
  if (!targetUrl) {
    throw new Error("Missing required target URL");
  }

  return {
    operatorBaseUrl: operatorBaseUrl.replace(/\/+$/, ""),
    targetUrl,
  } as const;
}

async function main() {
  const { operatorBaseUrl, targetUrl } = parseArgs(process.argv.slice(2));
  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl: operatorBaseUrl,
    employees: [
      {
        key: "productManager",
        roleId: "product-manager-web",
        teamId: "team_web_product",
        runtimeStatus: "planned",
        required: {
          scope: {
            allowedServices: ["service_dashboard"],
            allowedEnvironmentNames: ["preview"],
          },
        },
      },
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
        runtimeStatus: "implemented",
      },
    ],
  });

  console.log("[DEBUG] operatorBaseUrl:", operatorBaseUrl);
  console.log("[DEBUG] targetUrl:", targetUrl);

  const payload = {
    targetUrl,
    useControlPlaneBinding: true,
  };

  console.log("[DEBUG] payload:", JSON.stringify(payload));
  console.log(`Dispatching validation task for ${targetUrl}...`);

  const body = await retry(
    async () =>
      (await httpPost(`${operatorBaseUrl}/agent/tasks`, {
        companyId: "company_internal_aep",
        originatingTeamId: "team_web_product",
        assignedTeamId: "team_validation",
        createdByEmployeeId: liveEmployeeIds.productManager,
        assignedEmployeeId: liveEmployeeIds.reliabilityEngineer,
        taskType: "validate-deployment",
        title: "Post-deploy validation health check",
        payload,
      })) as { ok?: boolean; taskId?: string; error?: string },
    {
      label: "execute-validation-dispatch",
      attempts: 3,
      delayMs: 1000,
    },
  );

  if (!body.ok || typeof body.taskId !== "string" || body.taskId.length === 0) {
    throw new Error(`Failed to create task: ${body.error ?? "missing taskId"}`);
  }

  console.log(`TASK_ID=${body.taskId}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Execution failed: ${message}`);
  process.exit(1);
});