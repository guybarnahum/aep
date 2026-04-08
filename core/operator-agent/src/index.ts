import { handleControlHistory } from "./routes/control-history";
import { handleApprovalDetail } from "./routes/approval-detail";
import { handleApproveApproval } from "./routes/approvals-approve";
import { handleRejectApproval } from "./routes/approvals-reject";
import { handleApprovals } from "./routes/approvals";
import { handleBuildInfo } from "./routes/build-info";
import { handleEscalations } from "./routes/escalations";
import { handleAcknowledgeEscalation } from "./routes/escalations-acknowledge";
import { handleResolveEscalation } from "./routes/escalations-resolve";
import { handleHealthz } from "./routes/healthz";
import { handleEmployeeControls } from "./routes/employee-controls";
import { handleEmployeeEffectivePolicy } from "./routes/employee-effective-policy";
import { handleEmployees } from "./routes/employees";
import { handleEmployeeScope } from "./routes/employee-scope";
import { handleManagerLog } from "./routes/manager-log";
import { handleRun } from "./routes/run";
import { handleRunOnce } from "./routes/run-once";
import { handleSchedulerStatus } from "./routes/scheduler-status";
import { handleCreateTask, handleGetTask } from "./routes/tasks";
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
  // Debug: print ENABLE_TEST_ENDPOINTS value for troubleshooting
  console.log("[DEBUG] ENABLE_TEST_ENDPOINTS:", env.ENABLE_TEST_ENDPOINTS);
  const url = new URL(request.url);

  // Test endpoint: allow CI to trigger scheduled event via HTTP (POST /__scheduled)
  if (
    env.ENABLE_TEST_ENDPOINTS === "true" &&
    request.method === "POST" &&
    url.pathname === "/__scheduled"
  ) {
    const cron = url.searchParams.get("cron") ?? "* * * * *";
    const scheduledTimeMs = Number.parseInt(
      url.searchParams.get("scheduledTime") ?? `${Date.now()}`,
      10,
    );
    await handleScheduledCron(
      cron,
      env,
      Number.isFinite(scheduledTimeMs) ? scheduledTimeMs : Date.now(),
    );
    return Response.json({
      ok: true,
      trigger: "scheduled_test",
      cron,
    });
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return handleHealthz(request, env);
  }

  if (request.method === "GET" && url.pathname === "/build-info") {
    return handleBuildInfo(request, env);
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

  if (url.pathname === "/agent/tasks" && request.method === "POST") {
    return handleCreateTask(request, env);
  }

  const taskMatch = url.pathname.match(/^\/agent\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === "GET") {
    return handleGetTask(request, env, decodeURIComponent(taskMatch[1]));
  }

  if (url.pathname === "/agent/manager-log") {
    return handleManagerLog(request, env);
  }

  // Roadmap API endpoint for dashboard
  if (url.pathname === "/agent/roadmaps" && request.method === "GET") {
    if (!env.OPERATOR_AGENT_DB) {
      return new Response("Operator agent database not configured", { status: 500 });
    }
    const result = await env.OPERATOR_AGENT_DB.prepare(
      "SELECT * FROM team_roadmaps ORDER BY priority DESC, created_at DESC"
    ).all();
    return Response.json({ entries: result.results });
  }

  if (url.pathname === "/agent/employee-controls") {
    return handleEmployeeControls(request, env);
  }

  const employeeScopeMatch = url.pathname.match(/^\/agent\/employees\/([^/]+)\/scope$/);
  if (employeeScopeMatch) {
    return handleEmployeeScope(
      request,
      env,
      decodeURIComponent(employeeScopeMatch[1]),
    );
  }

  const employeePolicyMatch = url.pathname.match(
    /^\/agent\/employees\/([^/]+)\/effective-policy$/,
  );
  if (employeePolicyMatch) {
    return handleEmployeeEffectivePolicy(
      request,
      env,
      decodeURIComponent(employeePolicyMatch[1]),
    );
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

  if (url.pathname === "/agent/approvals/approve") {
    return handleApproveApproval(request, env);
  }

  if (url.pathname === "/agent/approvals/reject") {
    return handleRejectApproval(request, env);
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

  if (
    env.ENABLE_TEST_ENDPOINTS === "true" &&
    url.pathname === "/agent/work-log/seed"
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
    await handleScheduledCron(controller.cron, env, controller.scheduledTime);
  }
};
