import { handleHealthz } from "./routes/healthz";
import { handleManagerLog } from "./routes/manager-log";
import { handleRun } from "./routes/run";
import { handleRunOnce } from "./routes/run-once";
import { handleWorkLog } from "./routes/work-log";
import { handleCron } from "./triggers/cron";
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

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(
    _controller: ScheduledController,
    env: OperatorAgentEnv
  ): Promise<void> {
    await handleCron(env);
  }
};
