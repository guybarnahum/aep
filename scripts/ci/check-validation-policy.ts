#!/usr/bin/env node

type PolicyCheck = {
  validation_type: string;
  status: string;
  severity?: string | null;
  escalation_state?: string | null;
  audit_status?: string | null;
  freshness?: string | null;
  message?: string | null;
  dispatch_batch_id?: string | null;
};

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

  const freshnessMinutesRaw = args.get("freshness-minutes") ?? "30";
  const freshnessMinutes = Number(freshnessMinutesRaw);
  if (!Number.isFinite(freshnessMinutes) || freshnessMinutes <= 0) {
    throw new Error("Invalid --freshness-minutes, must be a positive number");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    freshnessMinutes: Math.trunc(freshnessMinutes),
    dispatchBatchId: args.get("dispatch-batch-id") ?? null,
  };
}

async function main() {
  const { baseUrl, freshnessMinutes, dispatchBatchId } = parseArgs(
    process.argv.slice(2),
  );

  const policyUrl = new URL(`${baseUrl}/validation/policy`);
  policyUrl.searchParams.set("freshness_minutes", String(freshnessMinutes));
  if (dispatchBatchId) {
    policyUrl.searchParams.set("dispatch_batch_id", dispatchBatchId);
  }

  const response = await fetch(policyUrl.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "aep-ci-validation-policy/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Validation policy request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    decision?: string;
    reason?: string;
    dispatch_batch_id?: string | null;
    checks?: PolicyCheck[];
  };

  if (body.decision !== "allow") {
    console.error("❌ Validation policy blocked release");
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("✅ Validation policy allows release");
  console.log(JSON.stringify(body, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${message}`);
  process.exit(1);
});