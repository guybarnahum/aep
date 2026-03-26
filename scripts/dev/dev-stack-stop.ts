import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type DevStackState = {
  version: 1;
  serviceMapPath: string;
  dashboardEnvLocalPath?: string;
  controlPlane: { pid: number };
  operatorAgent: { pid: number };
};

function killProcessGroup(pid: number): string {
  try {
    if (process.platform !== "win32") {
      process.kill(-pid, "SIGTERM");
    } else {
      process.kill(pid, "SIGTERM");
    }
    return "terminated";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function main(): void {
  const statePath = resolve(process.env.AEP_DEV_STACK_STATE_PATH ?? ".aep/dev-stack/state.json");

  if (!existsSync(statePath)) {
    console.log("AEP dev stack is not running", { statePath });
    return;
  }

  const state = JSON.parse(readFileSync(statePath, "utf8")) as DevStackState;

  const controlPlane = killProcessGroup(state.controlPlane.pid);
  const operatorAgent = killProcessGroup(state.operatorAgent.pid);

  rmSync(statePath, { force: true });
  rmSync(resolve(state.serviceMapPath), { force: true });
  if (state.dashboardEnvLocalPath) {
    rmSync(resolve(state.dashboardEnvLocalPath), { force: true });
  }

  console.log("Stopped AEP dev stack", {
    statePath,
    controlPlane,
    operatorAgent,
    removedServiceMap: state.serviceMapPath,
    removedDashboardEnvLocal: state.dashboardEnvLocalPath,
  });
}

main();