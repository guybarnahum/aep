import { mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

import { writeServiceMap } from "../lib/service-map";

type CliOptions = {
  controlPlanePort?: number;
  operatorAgentPort?: number;
  serviceMapPath?: string;
  statePath?: string;
  waitAttempts: number;
  waitIntervalMs: number;
  testScheduled: boolean;
  enableTestEndpoints: boolean;
};

type ProcessState = {
  pid: number;
  port: number;
  baseUrl: string;
  logPath: string;
  command: string[];
};

type DevStackState = {
  version: 1;
  startedAt: string;
  serviceMapPath: string;
  dashboardEnvLocalPath: string;
  controlPlane: ProcessState;
  operatorAgent: ProcessState;
};

const DEFAULT_STATE_PATH = ".aep/dev-stack/state.json";
const DEFAULT_LOG_DIR = ".aep/dev-stack/logs";

function renderDashboardEnvLocal(args: {
  controlPlaneBaseUrl: string;
  operatorAgentBaseUrl: string;
}): string {
  return [
    `VITE_CONTROL_PLANE_BASE_URL=${args.controlPlaneBaseUrl}`,
    `VITE_OPERATOR_AGENT_BASE_URL=${args.operatorAgentBaseUrl}`,
    "",
  ].join("\n");
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }

    args.set(key, next);
    index += 1;
  }

  return {
    controlPlanePort: args.get("control-plane-port")
      ? parsePositiveInt(args.get("control-plane-port")!, "control-plane-port")
      : undefined,
    operatorAgentPort: args.get("operator-agent-port")
      ? parsePositiveInt(args.get("operator-agent-port")!, "operator-agent-port")
      : undefined,
    serviceMapPath: args.get("service-map-path"),
    statePath: args.get("state-path"),
    waitAttempts: parsePositiveInt(args.get("wait-attempts") ?? "30", "wait-attempts"),
    waitIntervalMs: parsePositiveInt(
      args.get("wait-interval-ms") ?? "1000",
      "wait-interval-ms"
    ),
    testScheduled: parseBoolean(args.get("test-scheduled") ?? "true"),
    enableTestEndpoints: parseBoolean(args.get("enable-test-endpoints") ?? "true"),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveStatePath(customPath?: string): string {
  return resolve(customPath ?? DEFAULT_STATE_PATH);
}

async function findAvailablePort(preferred?: number): Promise<number> {
  if (preferred) {
    const isFree = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(preferred, "127.0.0.1");
    });

    if (isFree) {
      return preferred;
    }
  }

  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve available port")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.listen(0, "127.0.0.1");
  });
}

function killProcessGroup(pid: number): void {
  try {
    if (process.platform !== "win32") {
      process.kill(-pid, "SIGTERM");
      return;
    }
    process.kill(pid, "SIGTERM");
  } catch {
    // best-effort cleanup only
  }
}

async function waitForReady(args: {
  label: string;
  url: string;
  attempts: number;
  intervalMs: number;
}): Promise<void> {
  let lastStatus = 0;
  let lastBody = "";

  for (let index = 0; index < args.attempts; index += 1) {
    try {
      const response = await fetch(args.url);
      lastStatus = response.status;
      lastBody = (await response.text()).slice(0, 160);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastBody = error instanceof Error ? error.message : String(error);
    }

    if (index < args.attempts - 1) {
      await sleep(args.intervalMs);
    }
  }

  throw new Error(
    `${args.label} did not become ready at ${args.url}. Last status=${lastStatus}, last body=${lastBody}`
  );
}

function spawnDetached(args: {
  logPath: string;
  command: string[];
}): number {
  mkdirSync(dirname(args.logPath), { recursive: true });
  const logFd = openSync(args.logPath, "a");

  const child = spawn(args.command[0], args.command.slice(1), {
    cwd: resolve("."),
    detached: true,
    env: process.env,
    stdio: ["ignore", logFd, logFd],
  });

  child.unref();

  if (!child.pid) {
    throw new Error(`Failed to start ${args.command.join(" ")}`);
  }

  return child.pid;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const controlPlanePort = await findAvailablePort(options.controlPlanePort);
  const operatorAgentPort = await findAvailablePort(options.operatorAgentPort);
  const controlPlaneInspectorPort = await findAvailablePort();
  const operatorAgentInspectorPort = await findAvailablePort();

  if (controlPlanePort === operatorAgentPort) {
    throw new Error("Resolved duplicate ports for control-plane and operator-agent");
  }

  const controlPlaneBaseUrl = `http://127.0.0.1:${controlPlanePort}`;
  const operatorAgentBaseUrl = `http://127.0.0.1:${operatorAgentPort}`;
  const logDir = resolve(DEFAULT_LOG_DIR);
  const statePath = resolveStatePath(options.statePath);
  const serviceMapPath = resolve(options.serviceMapPath ?? ".aep/service-map.json");
  const dashboardEnvLocalPath = resolve("apps/dashboard/.env.local");

  rmSync(statePath, { force: true });

  const controlPlaneCommand = [
    "npx",
    "wrangler",
    "dev",
    "--config",
    "core/control-plane/wrangler.toml",
    "--port",
    String(controlPlanePort),
    "--inspector-port",
    String(controlPlaneInspectorPort),
  ];

  const operatorAgentCommand = [
    "npx",
    "wrangler",
    "dev",
    "--config",
    "core/operator-agent/wrangler.jsonc",
    "--port",
    String(operatorAgentPort),
    "--inspector-port",
    String(operatorAgentInspectorPort),
    "--var",
    `CONTROL_PLANE_BASE_URL:${controlPlaneBaseUrl}`,
  ];

  if (options.enableTestEndpoints) {
    operatorAgentCommand.push("--var", "ENABLE_TEST_ENDPOINTS:true");
  }

  if (options.testScheduled) {
    operatorAgentCommand.push("--test-scheduled");
  }

  const controlPlaneLogPath = resolve(logDir, "control-plane.log");
  const operatorAgentLogPath = resolve(logDir, "operator-agent.log");

  const controlPlanePid = spawnDetached({
    logPath: controlPlaneLogPath,
    command: controlPlaneCommand,
  });

  const operatorAgentPid = spawnDetached({
    logPath: operatorAgentLogPath,
    command: operatorAgentCommand,
  });

  const state: DevStackState = {
    version: 1,
    startedAt: new Date().toISOString(),
    serviceMapPath,
    dashboardEnvLocalPath,
    controlPlane: {
      pid: controlPlanePid,
      port: controlPlanePort,
      baseUrl: controlPlaneBaseUrl,
      logPath: controlPlaneLogPath,
      command: controlPlaneCommand,
    },
    operatorAgent: {
      pid: operatorAgentPid,
      port: operatorAgentPort,
      baseUrl: operatorAgentBaseUrl,
      logPath: operatorAgentLogPath,
      command: operatorAgentCommand,
    },
  };

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");

  try {
    await waitForReady({
      label: "control-plane",
      url: `${controlPlaneBaseUrl}/healthz`,
      attempts: options.waitAttempts,
      intervalMs: options.waitIntervalMs,
    });

    await waitForReady({
      label: "operator-agent",
      url: `${operatorAgentBaseUrl}/agent/scheduler-status`,
      attempts: options.waitAttempts,
      intervalMs: options.waitIntervalMs,
    });
  } catch (error) {
    killProcessGroup(controlPlanePid);
    killProcessGroup(operatorAgentPid);
    rmSync(statePath, { force: true });
    rmSync(serviceMapPath, { force: true });
    throw error;
  }

  writeServiceMap({
    path: serviceMapPath,
    services: {
      "control-plane": { baseUrl: controlPlaneBaseUrl },
      "operator-agent": { baseUrl: operatorAgentBaseUrl },
    },
  });

  mkdirSync(dirname(dashboardEnvLocalPath), { recursive: true });
  writeFileSync(
    dashboardEnvLocalPath,
    renderDashboardEnvLocal({ controlPlaneBaseUrl, operatorAgentBaseUrl }),
    "utf8"
  );

  console.log("AEP dev stack ready", {
    serviceMapPath,
    dashboardEnvLocalPath,
    statePath,
    controlPlaneBaseUrl,
    operatorAgentBaseUrl,
    controlPlanePid,
    operatorAgentPid,
    controlPlaneLogPath,
    operatorAgentLogPath,
  });
}

main().catch((error) => {
  console.error("Failed to start AEP dev stack");
  console.error(error);
  process.exit(1);
});