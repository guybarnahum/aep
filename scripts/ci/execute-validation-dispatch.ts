#!/usr/bin/env node

export {};

function parseArgs(argv: string[]) {
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

  const baseUrl = args.get("base-url");
  if (!baseUrl) {
    throw new Error("Missing required --base-url");
  }

  const mode = args.get("mode") ?? "full";
  if (mode !== "full" && mode !== "runtime_only") {
    throw new Error("Invalid --mode, must be full or runtime_only");
  }

  const requestedBy = args.get("requested-by") ?? "post_deploy_validation";
  const dispatchBatchId = args.get("dispatch-batch-id");

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    mode,
    requestedBy,
    dispatchBatchId,
  } as const;
}

async function main() {
  const { baseUrl, mode, requestedBy, dispatchBatchId } = parseArgs(
    process.argv.slice(2),
  );

  const response = await fetch(
    `${baseUrl}/internal/validation/execute-dispatch`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "aep-ci-execute-validation-dispatch/1.0",
      },
      body: JSON.stringify({
        dispatch_batch_id: dispatchBatchId ?? undefined,
        requested_by: requestedBy,
        target_base_url: baseUrl,
        mode,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Validation execution request failed with HTTP ${response.status}: ${text}`,
    );
  }

  const body = await response.json();

  console.log("Validation runs executed and audited");
  console.log(JSON.stringify(body, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Execution failed: ${message}`);
  process.exit(1);
});