import { handleControlHistory } from "./routes/control-history";
import { handleEscalations } from "./routes/escalations";
import { handleHealthz } from "./routes/healthz";
import { handleEmployeeControls } from "./routes/employee-controls";
import { handleEmployees } from "./routes/employees";
import { handleManagerLog } from "./routes/manager-log";
import { handleRun } from "./routes/run";
import { handleRunOnce } from "./routes/run-once";
import { handleWorkLog } from "./routes/work-log";
import { handleScheduledCron } from "./triggers/scheduled";
import type { OperatorAgentEnv } from "./types";

export default {
  async fetch(
    request: Request,
    env: OperatorAgentEnv
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return handleHealthz();
    }

    if (url.pathname === "/agent/run") {
      return handleRun(request, env);
    }

    if (url.pathname === "/agent/run-once") {
      return handleRunOnce(request, env);
    }

    if (url.pathname === "/agent/work-log") {
      return handleWorkLog(request, env);
    }

    if (url.pathname === "/agent/manager-log") {
      return handleManagerLog(request, env);
    }

    if (url.pathname === "/agent/employee-controls") {
      return handleEmployeeControls(request, env);
    }

    if (url.pathname === "/agent/employees") {
      return handleEmployees(request, env);
    }

    if (url.pathname === "/agent/escalations") {
      return handleEscalations(request, env);
    }

    if (url.pathname === "/agent/control-history") {
      return handleControlHistory(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(
    controller: ScheduledController,
    env: OperatorAgentEnv
  ): Promise<void> {
    await handleScheduledCron(controller.cron, env);
  }
};
