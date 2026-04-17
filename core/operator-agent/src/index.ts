import { handleControlHistory } from "./routes/control-history";
import { handleApprovalDetail } from "./routes/approval-detail";
import { handleApproveApproval } from "./routes/approvals-approve";
import { handleRejectApproval } from "./routes/approvals-reject";
import { handleApprovals } from "./routes/approvals";
import { handleBuildInfo } from "./routes/build-info";
import { handleEscalations } from "./routes/escalations";
import { handleAcknowledgeEscalation } from "./routes/escalations-acknowledge";
import { handleEscalationDetail } from "./routes/escalation-detail";
import { handleResolveEscalation } from "./routes/escalations-resolve";
import { handleHealthz } from "./routes/healthz";
import { handleEmployeeControls } from "./routes/employee-controls";
import { handleEmployeeEffectivePolicy } from "./routes/employee-effective-policy";
import { handleEmployees } from "./routes/employees";
import { handleEmployeeScope } from "./routes/employee-scope";
import { handleRoles } from "./routes/roles";
import { handleManagerLog } from "./routes/manager-log";
import { handleRun } from "./routes/run";
import { handleRunOnce } from "./routes/run-once";
import { handleSchedulerStatus } from "./routes/scheduler-status";
import {
  handleCreateTask,
  handleGetTask,
  handleListTasks,
} from "./routes/tasks";
import {
  handleCreateTaskArtifact,
  handleListTaskArtifacts,
} from "./routes/task-artifacts";
import {
  handleCreateMessage,
  handleCreateMessageThread,
  handleExternalAction,
  handleGetMessageThread,
  handleIngestExternalMessage,
  handleListInbox,
  handleListMessageThreads,
  handleListMessages,
  handleListOutbox,
} from "./routes/messages";
import {
  handleApproveFromThread,
  handleRejectFromThread,
} from "./routes/thread-approval-actions";
import {
  handleAcknowledgeFromThread,
  handleResolveFromThread,
} from "./routes/thread-escalation-actions";
import { handleDelegateTaskFromThread } from "./routes/thread-delegate-task";
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
  console.log("[DEBUG] ENABLE_TEST_ENDPOINTS:", env.ENABLE_TEST_ENDPOINTS);
  const url = new URL(request.url);

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

  if (url.pathname === "/agent/roles") {
    return handleRoles(request, env);
  }

  if (url.pathname === "/agent/work-log") {
    return handleWorkLog(request, env);
  }

  if (url.pathname === "/agent/tasks" && request.method === "GET") {
    return handleListTasks(request, env);
  }

  if (url.pathname === "/agent/tasks" && request.method === "POST") {
    return handleCreateTask(request, env);
  }

  const taskMatch = url.pathname.match(/^\/agent\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === "GET") {
    return handleGetTask(request, env, decodeURIComponent(taskMatch[1]));
  }

  const taskArtifactsMatch = url.pathname.match(/^\/agent\/tasks\/([^/]+)\/artifacts$/);
  if (taskArtifactsMatch && request.method === "GET") {
    return handleListTaskArtifacts(
      request,
      env,
      decodeURIComponent(taskArtifactsMatch[1]),
    );
  }

  if (taskArtifactsMatch && request.method === "POST") {
    return handleCreateTaskArtifact(
      request,
      env,
      decodeURIComponent(taskArtifactsMatch[1]),
    );
  }

  if (url.pathname === "/agent/messages" && request.method === "GET") {
    return handleListMessages(request, env);
  }

  if (url.pathname === "/agent/messages" && request.method === "POST") {
    return handleCreateMessage(request, env);
  }

  if (url.pathname === "/agent/messages/inbound" && request.method === "POST") {
    return handleIngestExternalMessage(request, env);
  }

  if (url.pathname === "/agent/messages/external-action" && request.method === "POST") {
    return handleExternalAction(request, env);
  }

  if (url.pathname === "/agent/message-threads" && request.method === "GET") {
    return handleListMessageThreads(request, env);
  }

  if (url.pathname === "/agent/message-threads" && request.method === "POST") {
    return handleCreateMessageThread(request, env);
  }

  const messageThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)$/);
  if (messageThreadMatch && request.method === "GET") {
    return handleGetMessageThread(
      request,
      env,
      decodeURIComponent(messageThreadMatch[1]),
    );
  }

  const approveFromThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)\/approve$/);
  if (approveFromThreadMatch && request.method === "POST") {
    return handleApproveFromThread(
      request,
      env,
      decodeURIComponent(approveFromThreadMatch[1]),
    );
  }

  const rejectFromThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)\/reject$/);
  if (rejectFromThreadMatch && request.method === "POST") {
    return handleRejectFromThread(
      request,
      env,
      decodeURIComponent(rejectFromThreadMatch[1]),
    );
  }

  const acknowledgeFromThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)\/acknowledge-escalation$/);
  if (acknowledgeFromThreadMatch && request.method === "POST") {
    return handleAcknowledgeFromThread(
      request,
      env,
      decodeURIComponent(acknowledgeFromThreadMatch[1]),
    );
  }

  const resolveFromThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)\/resolve-escalation$/);
  if (resolveFromThreadMatch && request.method === "POST") {
    return handleResolveFromThread(
      request,
      env,
      decodeURIComponent(resolveFromThreadMatch[1]),
    );
  }

  const delegateTaskFromThreadMatch = url.pathname.match(/^\/agent\/message-threads\/([^/]+)\/delegate-task$/);
  if (delegateTaskFromThreadMatch && request.method === "POST") {
    return handleDelegateTaskFromThread(
      request,
      env,
      decodeURIComponent(delegateTaskFromThreadMatch[1]),
    );
  }

  const inboxMatch = url.pathname.match(/^\/agent\/inbox\/([^/]+)$/);
  if (inboxMatch && request.method === "GET") {
    return handleListInbox(
      request,
      env,
      decodeURIComponent(inboxMatch[1]),
    );
  }

  const outboxMatch = url.pathname.match(/^\/agent\/outbox\/([^/]+)$/);
  if (outboxMatch && request.method === "GET") {
    return handleListOutbox(
      request,
      env,
      decodeURIComponent(outboxMatch[1]),
    );
  }

  if (url.pathname === "/agent/manager-log") {
    return handleManagerLog(request, env);
  }

  if (url.pathname === "/agent/roadmaps" && request.method === "GET") {
    if (!env.OPERATOR_AGENT_DB) {
      return new Response("Operator agent database not configured", { status: 500 });
    }
    const result = await env.OPERATOR_AGENT_DB.prepare(
      "SELECT * FROM team_roadmaps ORDER BY priority DESC, created_at DESC",
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

  const escalationMatch = url.pathname.match(/^\/agent\/escalations\/([^/]+)$/);
  if (escalationMatch && request.method === "GET") {
    return handleEscalationDetail(
      request,
      env,
      decodeURIComponent(escalationMatch[1]),
    );
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
    env: OperatorAgentEnv,
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return withCors(await dispatch(request, env));
  },

  async scheduled(
    controller: ScheduledController,
    env: OperatorAgentEnv,
  ): Promise<void> {
    await handleScheduledCron(controller.cron, env, controller.scheduledTime);
  },
};