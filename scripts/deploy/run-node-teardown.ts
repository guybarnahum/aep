#!/usr/bin/env node

import { DEFAULT_PROVIDER } from "../../packages/shared/src/index";
import { getNodeDeploymentAdapter } from "../../services/deployment-engine/src";

type SupportedProvider = "cloudflare" | "aws";
type TestFailStage = "before_running" | "after_running";

function parseArgs(argv: string[]): {
  provider: string;
  deploymentRef: string;
  callbackUrl?: string;
  callbackToken?: string;
  testFailStage?: TestFailStage;
  testRetryable?: boolean;
  testSkipTerminalCallback?: boolean;
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

  const parseOptionalBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) {
      return undefined;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    throw new Error(`Expected boolean flag value 'true' or 'false', got '${value}'`);
  };

  const deploymentRef = args.get("deployment-ref");
  const rawProvider = args.get("provider");
  const callbackUrl = args.get("callback-url");
  const callbackToken = args.get("callback-token");
  const rawTestFailStage = args.get("test-fail-stage");
  const testRetryable = parseOptionalBoolean(args.get("test-retryable"));
  const testSkipTerminalCallback = parseOptionalBoolean(args.get("test-skip-terminal-callback"));

  if (
    rawTestFailStage !== undefined &&
    rawTestFailStage !== "before_running" &&
    rawTestFailStage !== "after_running"
  ) {
    throw new Error(
      `Invalid --test-fail-stage: ${rawTestFailStage}. Expected before_running or after_running.`,
    );
  }

  if (!deploymentRef) {
    throw new Error(
      "Usage: tsx scripts/deploy/run-node-teardown.ts --deployment-ref sample-worker-run_test_3 [--provider cloudflare] [--callback-url https://.../internal/deploy-job-attempts/attempt_123/callback --callback-token token] [--test-fail-stage before_running|after_running] [--test-retryable true|false] [--test-skip-terminal-callback true|false]",
    );
  }

  if ((callbackUrl && !callbackToken) || (!callbackUrl && callbackToken)) {
    throw new Error("callback-url and callback-token must be provided together");
  }

  if ((rawTestFailStage || testSkipTerminalCallback) && (!callbackUrl || !callbackToken)) {
    throw new Error("Test callback injection flags require callback-url and callback-token");
  }

  return {
    provider: rawProvider ?? DEFAULT_PROVIDER,
    deploymentRef,
    callbackUrl,
    callbackToken,
    testFailStage: rawTestFailStage,
    testRetryable,
    testSkipTerminalCallback,
  };
}

function requireSupportedProvider(provider: string): SupportedProvider {
  switch (provider) {
    case "cloudflare":
    case "aws":
      return provider;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function getWorkingDirForProvider(provider: SupportedProvider): string {
  switch (provider) {
    case "cloudflare":
      return "examples/sample-worker";
    case "aws":
      return "examples/aws-lambda";
  }
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
    throw new Error(`Teardown callback failed: ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const {
    provider,
    deploymentRef,
    callbackUrl,
    callbackToken,
    testFailStage,
    testRetryable,
    testSkipTerminalCallback,
  } = parseArgs(
    process.argv.slice(2),
  );

  const selectedProvider = requireSupportedProvider(provider);

  const adapter = getNodeDeploymentAdapter(selectedProvider, {
    workingDir: getWorkingDirForProvider(selectedProvider),
  });

  try {
    if (testFailStage === "before_running") {
      if (callbackUrl && callbackToken) {
        await postCallback({
          callbackUrl,
          callbackToken,
          body: {
            status: "failed",
            retryable: testRetryable,
            error_message: "Injected test teardown failure before running",
          },
        });
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            callback_sent: Boolean(callbackUrl && callbackToken),
            deploymentRef,
            injected_failure: "before_running",
          },
          null,
          2,
        ),
      );

      return;
    }

    if (callbackUrl && callbackToken) {
      await postCallback({
        callbackUrl,
        callbackToken,
        body: {
          status: "running",
        },
      });
    }

    if (testFailStage === "after_running") {
      if (callbackUrl && callbackToken) {
        await postCallback({
          callbackUrl,
          callbackToken,
          body: {
            status: "failed",
            retryable: testRetryable,
            error_message: "Injected test teardown failure after running",
          },
        });
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            callback_sent: Boolean(callbackUrl && callbackToken),
            deploymentRef,
            injected_failure: "after_running",
          },
          null,
          2,
        ),
      );

      return;
    }

    if (testSkipTerminalCallback) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            callback_sent: Boolean(callbackUrl && callbackToken),
            deploymentRef,
            skipped_terminal_callback: true,
          },
          null,
          2,
        ),
      );

      return;
    }

    await adapter.teardownPreview(deploymentRef);

    const result = {
      provider: selectedProvider,
      deployment_ref: deploymentRef,
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