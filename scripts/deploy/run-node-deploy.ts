#!/usr/bin/env node

import { DEFAULT_PROVIDER, isProvider } from "../../packages/shared/src/index";
import { getNodeDeploymentAdapter } from "../../services/deployment-engine/src";

function parseArgs(argv: string[]): {
  provider: typeof DEFAULT_PROVIDER;
  serviceName: string;
  workflowRunId: string;
} {
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

  const serviceName = args.get("service-name");
  const workflowRunId = args.get("workflow-run-id");
  const rawProvider = args.get("provider");

  if (!serviceName || !workflowRunId) {
    throw new Error(
      "Usage: tsx scripts/deploy/run-node-deploy.ts --service-name sample-worker --workflow-run-id run_123 [--provider cloudflare]",
    );
  }

  return {
    provider: isProvider(rawProvider) ? rawProvider : DEFAULT_PROVIDER,
    serviceName,
    workflowRunId,
  };
}

async function main(): Promise<void> {
  const { provider, serviceName, workflowRunId } = parseArgs(process.argv.slice(2));

  const adapter = getNodeDeploymentAdapter(provider, {
    workingDir: "examples/sample-worker",
  });

  const result = await adapter.deployPreview({
    provider,
    serviceName,
    workflowRunId,
  });

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});