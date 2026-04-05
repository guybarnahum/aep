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

  const reason = args.get("reason") ?? "scheduled_health";
  if (
    reason !== "scheduled_health" &&
    reason !== "drift_detection" &&
    reason !== "governance_review"
  ) {
    throw new Error(
      "Invalid --reason, must be scheduled_health, drift_detection, or governance_review",
    );
  }

  const requestedBy = args.get("requested-by") ?? "recurring_validation";

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    mode,
    reason,
    requestedBy,
  } as const;
}

async function main() {
  const { baseUrl, mode, reason, requestedBy } = parseArgs(
    process.argv.slice(2),
  );

  const scheduleResponse = await fetch(
    `${baseUrl}/internal/validation/schedule-recurring`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "aep-ci-run-recurring-validation/1.0",
      },
      body: JSON.stringify({
        requested_by: requestedBy,
        target_base_url: baseUrl,
        mode,
        reason,
      }),
    },
  );

  if (!scheduleResponse.ok) {
    const text = await scheduleResponse.text();
    throw new Error(
      `Recurring validation schedule request failed with HTTP ${scheduleResponse.status}: ${text}`,
    );
  }

  const scheduled = (await scheduleResponse.json()) as {
    dispatch_batch_id?: string;
  };

  if (!scheduled.dispatch_batch_id) {
    throw new Error("Recurring validation response did not include dispatch_batch_id");
  }

  const executeResponse = await fetch(
    `${baseUrl}/internal/validation/execute-dispatch`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "aep-ci-run-recurring-validation/1.0",
      },
      body: JSON.stringify({
        dispatch_batch_id: scheduled.dispatch_batch_id,
        requested_by: requestedBy,
        target_base_url: baseUrl,
        mode,
      }),
    },
  );

  if (!executeResponse.ok) {
    const text = await executeResponse.text();
    throw new Error(
      `Recurring validation execute request failed with HTTP ${executeResponse.status}: ${text}`,
    );
  }

  const executed = await executeResponse.json();

  const policyUrl = new URL(`${baseUrl}/validation/policy`);
  policyUrl.searchParams.set("dispatch_batch_id", scheduled.dispatch_batch_id);
  policyUrl.searchParams.set("freshness_minutes", "30");

  const policyResponse = await fetch(policyUrl.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "aep-ci-run-recurring-validation/1.0",
    },
  });

  if (!policyResponse.ok) {
    throw new Error(
      `Recurring validation policy request failed with HTTP ${policyResponse.status}`,
    );
  }

  const policy = (await policyResponse.json()) as {
    decision?: string;
  };

  console.log("Recurring validation batch completed");
  console.log(
    JSON.stringify(
      {
        dispatch_batch_id: scheduled.dispatch_batch_id,
        executed,
        policy,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exit(1);
});