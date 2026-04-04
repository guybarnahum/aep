#!/usr/bin/env node

type VerdictCheck = {
  validation_type: string;
  status: string;
  severity?: string | null;
  owner_team?: string | null;
  audit_status?: string | null;
  freshness?: string | null;
  message?: string | null;
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
  };
}

async function main() {
  const { baseUrl, freshnessMinutes } = parseArgs(process.argv.slice(2));
  const response = await fetch(
    `${baseUrl}/validation/verdict?freshness_minutes=${freshnessMinutes}`,
    {
      headers: {
        accept: "application/json",
        "user-agent": "aep-ci-validation-verdict/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Validation verdict request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    team_id?: string;
    status?: string;
    freshness_minutes?: number;
    checks?: VerdictCheck[];
  };

  if (body.status !== "passed") {
    console.error("❌ Validation verdict failed");
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("✅ Validation verdict passed");
  console.log(JSON.stringify(body, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${message}`);
  process.exit(1);
});