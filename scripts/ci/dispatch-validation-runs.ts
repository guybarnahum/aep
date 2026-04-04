#!/usr/bin/env node

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

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    mode,
    requestedBy,
  } as const;
}

async function main() {
  const { baseUrl, mode, requestedBy } = parseArgs(process.argv.slice(2));

  const response = await fetch(
    `${baseUrl}/internal/validation/schedule-post-deploy`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "aep-ci-dispatch-validation-runs/1.0",
      },
      body: JSON.stringify({
        requested_by: requestedBy,
        target_base_url: baseUrl,
        mode,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Validation dispatch request failed with HTTP ${response.status}: ${text}`,
    );
  }

  const body = (await response.json()) as {
    dispatch_batch_id?: string;
  };

  if (!body.dispatch_batch_id) {
    throw new Error("Dispatch response did not include dispatch_batch_id");
  }

  console.log("Validation runs dispatched");
  console.log(JSON.stringify(body, null, 2));
  console.log(`DISPATCH_BATCH_ID=${body.dispatch_batch_id}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Dispatch failed: ${message}`);
  process.exit(1);
});