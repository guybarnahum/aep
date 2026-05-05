/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { postJson } from "../../shared/http";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { ciActor, ciArtifactMarker } from "../../shared/ci-artifacts";

type TeamLoopResult = {
  ok: true;
  status:
    | "executed_task"
    | "execution_failed"
    | "manager_review_requested"
    | "no_pending_tasks"
    | "waiting_for_staffing";
  taskId?: string;
  selection?: {
    status: "ready" | "queued";
    taskType: string;
    discipline: string;
    expectedForTeam: boolean;
    teamDisciplinePriority: number;
    taskTypePriority: number;
  };
  heartbeat?: {
    status: "published" | "skipped_missing_author";
    threadId?: string;
    messageId?: string;
  };
  scanned?: {
    pendingTasks: number;
    eligibleTasks: number;
  };
};

const CHECK_NAME = "team-loop-specialization-check";
const COMPANY_ID = `company_specialization_${Date.now()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getMessages(response: any): any[] {
  if (Array.isArray(response?.messages)) return response.messages;
  if (Array.isArray(response?.entries)) return response.entries;
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
    await client.endpointExists("/agent/teams/team_web_product/run-once");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const designTask = await client.createTask({
    companyId: COMPANY_ID,
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: ciActor(CHECK_NAME),
    taskType: "web_design",
    title: `Team loop specialization design ${Date.now()}`,
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
      targetUrl: "https://example.invalid/ci/design",
      objectiveTitle: "Team loop specialization ordering",
    },
  });

  if (!designTask?.ok || typeof designTask.taskId !== "string") {
    throw new Error(`Failed to create design task: ${JSON.stringify(designTask)}`);
  }

  const implementationTask = await client.createTask({
    companyId: COMPANY_ID,
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: ciActor(CHECK_NAME),
    taskType: "web_implementation",
    title: `Team loop specialization implementation ${Date.now()}`,
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
      targetUrl: "https://example.invalid/ci/implementation",
      requirementsRef: designTask.taskId,
    },
  });

  if (!implementationTask?.ok || typeof implementationTask.taskId !== "string") {
    throw new Error(
      `Failed to create implementation task: ${JSON.stringify(implementationTask)}`,
    );
  }

  // D1 writes from separate worker invocations may not be immediately visible
  // to the next read — different worker instances can land on different D1 read
  // replicas. Retry the team loop whenever eligibleTasks===0 (our company's
  // tasks weren't on the replica consulted), with exponential backoff. Also
  // catches genuine queue saturation where our tasks are pushed beyond the limit.
  const runLimit = 50;
  let runResult: TeamLoopResult | undefined;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    runResult = await postJson<TeamLoopResult>(
      `${client.baseUrl}/agent/teams/team_web_product/run-once`,
      {
        companyId: COMPANY_ID,
        limit: runLimit,
      },
    );

    if (runResult.status !== "no_pending_tasks") {
      break;
    }

    // Our tasks weren't visible on this replica (D1 lag) or are beyond the limit
    // (queue saturation). Either way, back off and retry.
    const tasksNotVisible = (runResult.scanned?.eligibleTasks ?? 0) === 0;
    if (!tasksNotVisible) {
      break;
    }

    await sleep(500 * attempt);
  }

  assert(runResult, "Expected runResult to be defined");

  if (runResult.status === "no_pending_tasks") {
    const tasksNotVisible = (runResult.scanned?.eligibleTasks ?? 0) === 0;

    if (tasksNotVisible) {
      console.log(`${CHECK_NAME} skipped`, {
        reason: "tasks not visible after retries (D1 lag or queue saturation)",
        companyId: COMPANY_ID,
        scanned: runResult.scanned,
      });
      return;
    }
  }

  assert(runResult.ok === true, "Expected team run result to be ok");
  assert(
    runResult.status !== "no_pending_tasks",
    `Expected selected work for specialization check: ${JSON.stringify(runResult)}`,
  );
  assert(
    runResult.taskId === designTask.taskId,
    `Expected web_design to be selected before web_implementation, got ${String(runResult.taskId)}`,
  );
  assert(runResult.selection, "Expected specialization metadata in team loop result");
  assert(
    runResult.selection?.taskType === "web_design",
    `Expected selection.taskType=web_design, got ${String(runResult.selection?.taskType)}`,
  );
  assert(
    runResult.selection?.discipline === "web",
    `Expected selection.discipline=web, got ${String(runResult.selection?.discipline)}`,
  );
  assert(
    runResult.selection?.expectedForTeam === true,
    "Expected selection.expectedForTeam=true",
  );

  if (
    runResult.heartbeat?.status === "published" &&
    runResult.heartbeat.threadId &&
    runResult.heartbeat.messageId
  ) {
    const messages = await client.listMessages({
      threadId: runResult.heartbeat.threadId,
      limit: 25,
    });
    const entries = getMessages(messages);
    const heartbeatMessage = entries.find(
      (entry) => entry?.id === runResult.heartbeat?.messageId,
    );
    assert(heartbeatMessage, "Expected heartbeat message to be persisted");
    assert(
      heartbeatMessage.payload?.selection?.taskType === "web_design",
      `Expected heartbeat payload selection taskType=web_design: ${JSON.stringify(heartbeatMessage)}`,
    );
  }

  console.log("team-loop-specialization-check passed", {
    companyId: COMPANY_ID,
    selectedTaskId: runResult.taskId,
    selection: runResult.selection,
  });
}

void main().catch((error) => {
  console.error("team-loop-specialization-check failed");
  console.error(error);
  process.exit(1);
});
