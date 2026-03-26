import { handleControlHistory } from "./routes/control-history";
import { handleApprovalDetail } from "./routes/approval-detail";
import { handleApprovals } from "./routes/approvals";
import { handleEscalations } from "./routes/escalations";
import { handleAcknowledgeEscalation } from "./routes/escalations-acknowledge";
import { handleResolveEscalation } from "./routes/escalations-resolve";
import { handleHealthz } from "./routes/healthz";
import { handleEmployeeControls } from "./routes/employee-controls";
import { handleEmployees } from "./routes/employees";
import { handleManagerLog } from "./routes/manager-log";
import { handleRun } from "./routes/run";
import { handleRunOnce } from "./routes/run-once";
import { handleSchedulerStatus } from "./routes/scheduler-status";
import { handleSeedApproval } from "./routes/te-seed-approval";
import { handleSeedWorkLog } from "./routes/te-seed-work-log";
import { handleWorkLog } from "./routes/work-log";
import { handleScheduledCron } from "./triggers/scheduled";
import type { OperatorAgentEnv } from "./types";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response: Response): Response {
  const next = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS_HEADERS)) next.headers.set(k, v);
  return next;
}

async function dispatch(request: Request, env: OperatorAgentEnv): Promise<Response> {
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

  if (url.pathname === "/agent/approvals") {
    return handleApprovals(request, env);
  }

  const approvalMatch = url.pathname.match(/^\/agent\/approvals\/([^/]+)$/);
  if (approvalMatch) {
    return handleApprovalDetail(request, env, decodeURIComponent(approvalMatch[1]));
  }

  if (url.pathname === "/agent/escalations/acknowledge") {
    return handleAcknowledgeEscalation(request, env);
  }

  if (url.pathname === "/agent/escalations/resolve") {
    return handleResolveEscalation(request, env);
  }

  if (url.pathname === "/agent/control-history") {
    return handleControlHistory(request, env);
  }

  if (request.method === "GET" && url.pathname === "/agent/scheduler-status") {
    return handleSchedulerStatus(request, env);
  }

  if (
    env.ENABLE_TEST_ENDPOINTS === "true" &&
    url.pathname === "/agent/te/seed-approval"
  ) {
    return handleSeedApproval(request, env);
  }

  if (
    env.ENABLE_TEST_ENDPOINTS === "true" &&
    url.pathname === "/agent/te/seed-work-log"
  ) {
    return handleSeedWorkLog(request, env);
  }

  return new Response("Not Found", { status: 404 });
}

export default {
  async fetch(
    request: Request,
    env: OperatorAgentEnv
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return withCors(await dispatch(request, env));
  },

  async scheduled(
    controller: ScheduledController,
    env: OperatorAgentEnv
  ): Promise<void> {
    await handleScheduledCron(controller.cron, env);
  }
};
