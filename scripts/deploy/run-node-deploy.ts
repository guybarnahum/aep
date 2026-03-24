#!/usr/bin/env node

import { DEFAULT_PROVIDER, isProvider } from "../../packages/shared/src/index";
import { getNodeDeploymentAdapter } from "../../services/deployment-engine/src";

type TestFailStage = "before_running" | "after_running";

async function postCallback(args: {
  callbackUrl: string;
  callbackToken: string;
  body: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch(args.callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.callbackToken}`,
    },
    body: JSON.stringify(args.body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Callback failed with status ${response.status}: ${text || response.statusText}`,
    );
  }
}

function parseArgs(argv: string[]): {
  provider: typeof DEFAULT_PROVIDER;
  serviceName: string;
  workflowRunId: string;
  jobId?: string;
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

  const serviceName = args.get("service-name");
  const workflowRunId = args.get("workflow-run-id");
  const rawProvider = args.get("provider");
  const jobId = args.get("job-id");
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

  if (!serviceName || !workflowRunId) {
    throw new Error(
      "Usage: tsx scripts/deploy/run-node-deploy.ts --service-name sample-worker --workflow-run-id run_123 [--provider cloudflare] [--job-id job_123 --callback-url https://.../internal/deploy-job-attempts/attempt_123/callback --callback-token token] [--test-fail-stage before_running|after_running] [--test-retryable true|false] [--test-skip-terminal-callback true|false]",
    );
  }

  if ((callbackUrl && !callbackToken) || (!callbackUrl && callbackToken)) {
    throw new Error(
      "callback-url and callback-token must be provided together",
    );
  }

  if ((rawTestFailStage || testSkipTerminalCallback) && (!callbackUrl || !callbackToken)) {
    throw new Error("Test callback injection flags require callback-url and callback-token");
  }

  return {
    provider: isProvider(rawProvider) ? rawProvider : DEFAULT_PROVIDER,
    serviceName,
    workflowRunId,
    jobId,
    callbackUrl,
    callbackToken,
    testFailStage: rawTestFailStage,
    testRetryable,
    testSkipTerminalCallback,
  };
}

async function main(): Promise<void> {
  const {
    provider,
    serviceName,
    workflowRunId,
    jobId,
    callbackUrl,
    callbackToken,
    testFailStage,
    testRetryable,
    testSkipTerminalCallback,
  } = parseArgs(process.argv.slice(2));

  const adapter = getNodeDeploymentAdapter(provider, {
    workingDir: "examples/sample-worker",
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
            error_message: "Injected test failure before running",
          },
        });
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            callback_sent: Boolean(callbackUrl && callbackToken),
            job_id: jobId ?? null,
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
            error_message: "Injected test failure after running",
          },
        });
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            callback_sent: Boolean(callbackUrl && callbackToken),
            job_id: jobId ?? null,
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
            job_id: jobId ?? null,
            skipped_terminal_callback: true,
          },
          null,
          2,
        ),
      );

      return;
    }
    
    const result = await adapter.deployPreview({
      provider,
      serviceName,
      workflowRunId,
    });

    console.log(JSON.stringify(result, null, 2));

    if (callbackUrl && callbackToken) {
        await postCallback({
            callbackUrl,
            callbackToken,
            body: {
            status: "succeeded",
            result: {
                deployment_ref: result.deploymentRef,
                preview_url: result.previewUrl,
            },
            },
        });

        console.log(
            JSON.stringify(
            {
                ok: true,
                callback_sent: true,
                job_id: jobId ?? null,
            },
            null,
            2,
            ),
        );
    }
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

      console.error(
        JSON.stringify(
          {
            ok: false,
            callback_sent: true,
            job_id: jobId ?? null,
            error:
              error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );

      return;
    }

    throw error;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});