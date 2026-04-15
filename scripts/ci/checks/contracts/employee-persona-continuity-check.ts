import { createOperatorAgentClient } from "../../clients/operator-agent-client";

const FORBIDDEN_PERSONA_FIELDS = [
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "basePrompt",
  "promptVersion",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "base_prompt",
  "prompt_version",
  "privateReasoning",
  "private_reasoning",
  "internalMonologue",
  "internal_monologue",
];

const PM_STYLE_MARKERS = [
  "structured",
  "alignment",
  "execution",
  "priority",
  "sequencing",
  "roadmap",
];

const VALIDATION_STYLE_MARKERS = [
  "evidence",
  "operational",
  "assessment",
  "health",
  "validation",
  "reviewed",
];

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private persona field ${field}`);
    }
  }
}

function countMarkers(text: string, markers: string[]): number {
  const normalized = text.toLowerCase();
  return markers.filter((marker) => normalized.includes(marker.toLowerCase())).length;
}

function extractRationaleText(artifact: Record<string, unknown>): string {
  const content =
    artifact.content && typeof artifact.content === "object"
      ? (artifact.content as Record<string, unknown>)
      : undefined;

  const parts = [
    typeof artifact.summary === "string" ? artifact.summary : "",
    typeof content?.summary === "string" ? content.summary : "",
    typeof content?.rationale === "string" ? content.rationale : "",
    typeof content?.recommendedNextAction === "string"
      ? content.recommendedNextAction
      : "",
  ].filter(Boolean);

  return parts.join(" ").trim();
}

function extractEmployeeId(taskDetail: Record<string, unknown>): string | undefined {
  const decision =
    taskDetail.decision && typeof taskDetail.decision === "object"
      ? (taskDetail.decision as Record<string, unknown>)
      : undefined;

  if (typeof decision?.employeeId === "string") {
    return decision.employeeId;
  }

  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  for (const artifact of artifacts) {
    if (typeof artifact.createdByEmployeeId === "string") {
      return artifact.createdByEmployeeId;
    }
  }

  return undefined;
}

function findPublicRationaleArtifact(
  taskDetail: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  return artifacts.find((artifact) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    return content?.kind === "public_rationale";
  });
}

function classifyRationaleStyle(text: string): {
  pmScore: number;
  validationScore: number;
} {
  return {
    pmScore: countMarkers(text, PM_STYLE_MARKERS),
    validationScore: countMarkers(text, VALIDATION_STYLE_MARKERS),
  };
}

async function loadCandidateTasks(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (const status of ["completed", "failed"] as const) {
    const response = await client.listTasks({ status, limit: 20 });
    if (!response?.ok) {
      throw new Error(`Failed to list ${status} tasks: ${JSON.stringify(response)}`);
    }

    if (Array.isArray(response.tasks)) {
      results.push(...(response.tasks as Record<string, unknown>[]));
    }
  }

  return results;
}

async function findPersonaSamples(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<{
  pmSample?: { taskId: string; text: string; taskDetail: Record<string, unknown> };
  validationSample?: { taskId: string; text: string; taskDetail: Record<string, unknown> };
}> {
  const tasks = await loadCandidateTasks(client);

  let pmSample:
    | { taskId: string; text: string; taskDetail: Record<string, unknown> }
    | undefined;
  let validationSample:
    | { taskId: string; text: string; taskDetail: Record<string, unknown> }
    | undefined;

  for (const task of tasks) {
    if (!task?.id || typeof task.id !== "string") continue;

    const taskDetail = await client.getTask(task.id);
    if (!taskDetail?.ok) continue;

    const artifact = findPublicRationaleArtifact(taskDetail as Record<string, unknown>);
    if (!artifact) continue;

    const text = extractRationaleText(artifact);
    if (!text) continue;

    const employeeId = extractEmployeeId(taskDetail as Record<string, unknown>);
    if (employeeId === "emp_pm_01" && !pmSample) {
      pmSample = { taskId: task.id, text, taskDetail: taskDetail as Record<string, unknown> };
    }
    if (employeeId === "emp_val_specialist_01" && !validationSample) {
      validationSample = {
        taskId: task.id,
        text,
        taskDetail: taskDetail as Record<string, unknown>,
      };
    }

    if (pmSample && validationSample) {
      break;
    }
  }

  return { pmSample, validationSample };
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const { pmSample, validationSample } = await findPersonaSamples(client);

  if (!pmSample || !validationSample) {
    console.warn(
      "[warn] employee-persona-continuity-check soft-skipped: insufficient live PM/validation rationale samples available",
    );
    process.exit(0);
  }

  assertFieldsAbsent(pmSample.taskDetail, FORBIDDEN_PERSONA_FIELDS, `/agent/tasks/${pmSample.taskId}`);
  assertFieldsAbsent(
    validationSample.taskDetail,
    FORBIDDEN_PERSONA_FIELDS,
    `/agent/tasks/${validationSample.taskId}`,
  );

  const pmStyle = classifyRationaleStyle(pmSample.text);
  const validationStyle = classifyRationaleStyle(validationSample.text);

  if (pmStyle.pmScore <= pmStyle.validationScore) {
    throw new Error(
      `PM rationale did not show stronger PM-style continuity markers. Scores: ${JSON.stringify(pmStyle)}`,
    );
  }

  if (validationStyle.validationScore <= validationStyle.pmScore) {
    throw new Error(
      `Validation rationale did not show stronger validation-style continuity markers. Scores: ${JSON.stringify(validationStyle)}`,
    );
  }

  const pmThreads = await client.listMessageThreads({
    relatedTaskId: pmSample.taskId,
    limit: 20,
  });

  if (pmThreads?.ok && Array.isArray(pmThreads.threads)) {
    for (const thread of pmThreads.threads) {
      if (!thread?.id) continue;
      const detail = await client.getMessageThread(thread.id);
      if (!detail?.ok || !Array.isArray(detail.messages)) continue;

      detail.messages.forEach((message: Record<string, unknown>, index: number) => {
        assertFieldsAbsent(
          message,
          FORBIDDEN_PERSONA_FIELDS,
          `/agent/message-threads/${thread.id}/messages[${index}]`,
        );
      });
    }
  }

  const validationThreads = await client.listMessageThreads({
    relatedTaskId: validationSample.taskId,
    limit: 20,
  });

  if (validationThreads?.ok && Array.isArray(validationThreads.threads)) {
    for (const thread of validationThreads.threads) {
      if (!thread?.id) continue;
      const detail = await client.getMessageThread(thread.id);
      if (!detail?.ok || !Array.isArray(detail.messages)) continue;

      detail.messages.forEach((message: Record<string, unknown>, index: number) => {
        assertFieldsAbsent(
          message,
          FORBIDDEN_PERSONA_FIELDS,
          `/agent/message-threads/${thread.id}/messages[${index}]`,
        );
      });
    }
  }

  console.log("employee-persona-continuity-check passed", {
    pmTaskId: pmSample.taskId,
    validationTaskId: validationSample.taskId,
    pmScores: pmStyle,
    validationScores: validationStyle,
  });
}

main().catch((error) => {
  console.error("employee-persona-continuity-check failed", error);
  process.exit(1);
});