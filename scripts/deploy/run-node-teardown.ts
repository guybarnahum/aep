#!/usr/bin/env node

import { DEFAULT_PROVIDER, isProvider } from "../../packages/shared/src/index";
import { getNodeDeploymentAdapter } from "../../services/deployment-engine/src";

function parseArgs(argv: string[]): {
  provider: typeof DEFAULT_PROVIDER;
  deploymentRef: string;
  callbackUrl?: string;
  callbackToken?: string;
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

  const deploymentRef = args.get("deployment-ref");
  const rawProvider = args.get("provider");

  if (!deploymentRef) {
    throw new Error(
      "Usage: tsx scripts/deploy/run-node-teardown.ts --deployment-ref sample-worker-run_test_3 [--provider cloudflare] [--callback-url ... --callback-token ...]",
    );
  }

  return {
    provider: isProvider(rawProvider) ? rawProvider : DEFAULT_PROVIDER,
    deploymentRef,
    callbackUrl: args.get("callback-url"),
    callbackToken: args.get("callback-token"),
  };
}

async function postCallback(args: {
  callbackUrl: string;
  callbackToken: string;
  body: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(args.callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.callbackToken}`,
    },
    body: JSON.stringify(args.body),
  });

  if (!res.ok) {
    throw new Error(`Callback failed: ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const { provider, deploymentRef, callbackUrl, callbackToken } = parseArgs(
    process.argv.slice(2),
  );

  const adapter = getNodeDeploymentAdapter(provider, {
    workingDir: "examples/sample-worker",
  });

  try {
    await adapter.teardownPreview(deploymentRef);

    const result = {
      provider,
      deploymentRef,
      status: "destroyed",
    };

    if (callbackUrl && callbackToken) {
      await postCallback({
        callbackUrl,
        callbackToken,
        body: {
          status: "succeeded",
          result,
        },
      });
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (callbackUrl && callbackToken) {
      await postCallback({
        callbackUrl,
        callbackToken,
        body: {
          status: "failed",
          error_message:
            error instanceof Error ? error.message : String(error),
        },
      });
    }

    throw error;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});