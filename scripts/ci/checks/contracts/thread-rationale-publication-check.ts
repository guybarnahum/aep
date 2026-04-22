/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

const FORBIDDEN_PRIVATE_FIELDS = [
  "internalMonologue",
  "internal_monologue",
  "privateReasoning",
  "private_reasoning",
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
];

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  try {
    await client.endpointExists("/agent/tasks");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("thread-rationale-publication-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "manager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
      },
    ],
  });
  const managerEmployeeId = liveEmployeeIds.manager;
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: reliabilityEngineerEmployeeId,
    createdByEmployeeId: managerEmployeeId,
    taskType: "validate-deployment",
    title: "PR7.8D thread rationale publication task",
    payload: {
      targetUrl: getTargetUrl(),
      source: "thread-rationale-publication-check",
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create task: ${JSON.stringify(task)}`);
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "Validation rationale thread",
    createdByEmployeeId: managerEmployeeId,
    relatedTaskId: task.taskId,
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create related message thread: ${JSON.stringify(thread)}`);
  }

  const result = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: reliabilityEngineerEmployeeId,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-thread-rationale-publication-check",
    taskId: task.taskId,
  });

  if (!result?.ok || result?.status !== "completed") {
    throw new Error(`Expected completed run response, got ${JSON.stringify(result)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail: ${JSON.stringify(taskDetail)}`);
  }

  const rationaleArtifact = Array.isArray(taskDetail.artifacts)
    ? taskDetail.artifacts.find((artifact: any) => artifact?.content?.kind === "public_rationale")
    : undefined;

  if (!rationaleArtifact?.id) {
    throw new Error(`Expected public rationale artifact, got ${JSON.stringify(taskDetail.artifacts)}`);
  }

  const threadDetail = await client.getMessageThread(thread.threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  const rationaleMessage = threadDetail.messages.find((message: any) => (
    message?.relatedTaskId === task.taskId
    && message?.relatedArtifactId === rationaleArtifact.id
    && message?.payload?.kind === "public_rationale_publication"
  ));

  if (!rationaleMessage) {
    throw new Error(`Expected published rationale message, got ${JSON.stringify(threadDetail.messages)}`);
  }

  if (typeof rationaleMessage.body !== "string" || !rationaleMessage.body.trim()) {
    throw new Error(`Expected non-empty rationale message body, got ${JSON.stringify(rationaleMessage)}`);
  }

  assertFieldsAbsent(
    rationaleMessage.body,
    FORBIDDEN_PRIVATE_FIELDS,
    "/agent/message-threads/:id rationale message body",
  );

  if (rationaleMessage.payload && typeof rationaleMessage.payload === "object") {
    assertFieldsAbsent(
      rationaleMessage.payload,
      FORBIDDEN_PRIVATE_FIELDS,
      "/agent/message-threads/:id rationale message payload",
    );
  }

  console.log("thread-rationale-publication-check passed", {
    taskId: task.taskId,
    threadId: thread.threadId,
    artifactId: rationaleArtifact.id,
    messageId: rationaleMessage.id,
  });
}

main().catch((error) => {
  console.error("thread-rationale-publication-check failed");
  console.error(error);
  process.exit(1);
});