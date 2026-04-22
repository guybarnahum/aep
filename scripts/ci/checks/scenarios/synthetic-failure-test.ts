/* eslint-disable no-console */

import { execFileSync } from "node:child_process";

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";
import { retry } from "../../tasks/retry";

export {};

type SqlRow = Record<string, unknown>;

type ExecuteJson = {
  result?: Array<{
    results?: SqlRow[];
    success?: boolean;
  }>;
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

type ExecuteJsonResult = {
  results?: SqlRow[];
  success?: boolean;
};

type HealthzResponse = {
  policyVersion?: string;
};

type RunResponse = {
  ok?: boolean;
  message?: string;
  summary?: {
    processed?: number;
    remediations?: number;
  };
};

type JsonRecord = Record<string, unknown>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function execSql(sql: string): SqlRow[] {
  const wranglerConfigPath = requireEnv("WRANGLER_CONFIG_PATH");
  const databaseRef = process.env.D1_DATABASE_REF ?? "OPERATOR_AGENT_DB";
  const executionLocation = process.env.WRANGLER_D1_EXECUTION_LOCATION;

  if (executionLocation === "remote") {
    requireEnv("CLOUDFLARE_API_TOKEN");
    requireEnv("CLOUDFLARE_ACCOUNT_ID");
  }

  const args = [
    "wrangler",
    "d1",
    "execute",
    databaseRef,
    "--config",
    wranglerConfigPath,
  ];

  if (executionLocation === "local") {
    args.push("--local");
  } else if (executionLocation === "remote") {
    args.push("--remote");
  }

  const cfEnv = process.env.CF_ENV;
  if (cfEnv) {
    args.push("--env", cfEnv);
  }

  args.push("--command", sql, "--json");

  const output = execFileSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const parsed = JSON.parse(output) as ExecuteJson | ExecuteJsonResult[];
  if (!Array.isArray(parsed) && (parsed.success === false || parsed.errors?.length)) {
    throw new Error(`wrangler d1 execute failed for SQL: ${sql}`);
  }

  const result = Array.isArray(parsed) ? parsed[0] : parsed.result?.[0];
  if (!result || result.success === false) {
    throw new Error(`No SQL result returned for query: ${sql}`);
  }

  return result.results ?? [];
}

async function getPolicyVersion(agentBaseUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${agentBaseUrl}/healthz`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GET ${agentBaseUrl}/healthz failed: ${message}`);
  }

  const body = (await response.json()) as HealthzResponse;

  if (!response.ok || typeof body.policyVersion !== "string" || body.policyVersion.length === 0) {
    throw new Error(`Unable to resolve policyVersion from ${agentBaseUrl}/healthz`);
  }

  return body.policyVersion;
}

async function postRun(
  agentBaseUrl: string,
  policyVersion: string,
  employeeId: string,
): Promise<RunResponse> {
  let response: Response;
  try {
    response = await fetch(`${agentBaseUrl}/agent/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aep-execution-source": "test",
      },
      body: JSON.stringify({
        companyId: "company_internal_aep",
        teamId: "team_validation",
        employeeId,
        roleId: "reliability-engineer",
        trigger: "manual",
        policyVersion,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`POST ${agentBaseUrl}/agent/run failed: ${message}`);
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `POST /agent/run failed: status=${response.status} body=${JSON.stringify(body)}`,
    );
  }

  return body as RunResponse;
}

function getSingleRow(sql: string): SqlRow {
  const rows = execSql(sql);
  if (rows.length < 1) {
    throw new Error(`Expected at least one row for query: ${sql}`);
  }
  return rows[0];
}

function cleanupTaskArtifacts(taskId: string): void {
  execSql(`DELETE FROM decisions WHERE task_id = ${sqlLiteral(taskId)}`);
  execSql(`DELETE FROM tasks WHERE id = ${sqlLiteral(taskId)}`);
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_URL",
    serviceName: "operator-agent",
  });
  const reliabilityEngineerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "reliability-engineer",
    teamId: "team_validation",
    runtimeStatus: "implemented",
  });
  const targetUrl = process.env.SYNTHETIC_FAILURE_URL ?? "https://httpstat.us/500";
  const policyVersion = process.env.AEP_POLICY_VERSION ?? (await getPolicyVersion(agentBaseUrl));
  const taskId = `test_fail_${Date.now()}`;
  let seeded = false;

  console.log("Starting Synthetic Failure Test...");

  try {
    execSql(
      `INSERT INTO tasks (
        id,
        company_id,
        team_id,
        employee_id,
        task_type,
        status,
        payload
      ) VALUES (
        ${sqlLiteral(taskId)},
        ${sqlLiteral("company_internal_aep")},
        ${sqlLiteral("team_validation")},
        ${sqlLiteral(reliabilityEngineerEmployeeId)},
        ${sqlLiteral("validate-deployment")},
        'pending',
        ${sqlLiteral(JSON.stringify({ targetUrl }))}
      )`,
    );
    seeded = true;

    console.log(`Seeded failing task: ${taskId}`);

    const runResponse = await retry(
      async () => postRun(agentBaseUrl, policyVersion),
      async () => postRun(agentBaseUrl, policyVersion, reliabilityEngineerEmployeeId),
      {
        label: "synthetic-failure-test run dispatch",
        attempts: 3,
        delayMs: 1000,
      },
    );

    console.log(`Validation agent response: ${runResponse.message ?? "<no message>"}`);

    const decision = getSingleRow(
      `SELECT verdict, reasoning
       FROM decisions
       WHERE task_id = ${sqlLiteral(taskId)}
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    const task = getSingleRow(
      `SELECT status
       FROM tasks
       WHERE id = ${sqlLiteral(taskId)}
       LIMIT 1`,
    );

    if (String(decision.verdict ?? "") !== "remediate") {
      throw new Error(
        `Expected remediate verdict for ${taskId}, got ${String(decision.verdict ?? "<missing>")}`,
      );
    }

    if (String(task.status ?? "") !== "completed") {
      throw new Error(
        `Expected task ${taskId} to be completed, got ${String(task.status ?? "<missing>")}`,
      );
    }

    console.log("SUCCESS: Agent detected failure and recorded a durable remediate decision.");
    console.log(`Reasoning: ${String(decision.reasoning ?? "<missing>")}`);
  } finally {
    if (seeded) {
      try {
        cleanupTaskArtifacts(taskId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Cleanup failed for ${taskId}: ${message}`);
      }
    }
  }
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("synthetic-failure-test", error)) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});