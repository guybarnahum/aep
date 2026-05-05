import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

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

const EXPECTED_PM_STYLE = "structured_alignment";
const EXPECTED_VALIDATION_STYLE = "operational_evidence";

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private persona field ${field}`);
    }
  }
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

function extractPresentationStyleFromArtifact(
  artifact: Record<string, unknown>,
): string | undefined {
  const content =
    artifact.content && typeof artifact.content === "object"
      ? (artifact.content as Record<string, unknown>)
      : undefined;

  return typeof content?.presentationStyle === "string"
    ? content.presentationStyle
    : undefined;
}

function findPublishedRationaleMessageStyle(
  messages: Record<string, unknown>[],
): string | undefined {
  for (const message of messages) {
    const payload =
      message.payload && typeof message.payload === "object"
        ? (message.payload as Record<string, unknown>)
        : undefined;

    if (
      payload?.kind === "public_rationale_publication" &&
      typeof payload.presentationStyle === "string"
    ) {
      return payload.presentationStyle;
    }
  }

  return undefined;
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
  employeeIdsByKey: {
    productManager: string;
    reliabilityEngineer: string;
  },
): Promise<{
  pmSample?: {
    taskId: string;
    taskDetail: Record<string, unknown>;
    artifact: Record<string, unknown>;
  };
  validationSample?: {
    taskId: string;
    taskDetail: Record<string, unknown>;
    artifact: Record<string, unknown>;
  };
}> {
  const tasks = await loadCandidateTasks(client);

  let pmSample:
    | {
        taskId: string;
        taskDetail: Record<string, unknown>;
        artifact: Record<string, unknown>;
      }
    | undefined;
  let validationSample:
    | {
        taskId: string;
        taskDetail: Record<string, unknown>;
        artifact: Record<string, unknown>;
      }
    | undefined;

  for (const task of tasks) {
    if (!task?.id || typeof task.id !== "string") continue;

    const taskDetail = await client.getTask(task.id);
    if (!taskDetail?.ok) continue;

    const artifact = findPublicRationaleArtifact(taskDetail as Record<string, unknown>);
    if (!artifact) continue;

    const employeeId = extractEmployeeId(taskDetail as Record<string, unknown>);
    if (employeeId === employeeIdsByKey.productManager && !pmSample) {
      pmSample = {
        taskId: task.id,
        taskDetail: taskDetail as Record<string, unknown>,
        artifact,
      };
    }
    if (employeeId === employeeIdsByKey.reliabilityEngineer && !validationSample) {
      validationSample = {
        taskId: task.id,
        taskDetail: taskDetail as Record<string, unknown>,
        artifact,
      };
    }

    if (pmSample && validationSample) {
      break;
    }
  }

  return { pmSample, validationSample };
}

async function assertThreadStyleConsistency(args: {
  client: ReturnType<typeof createOperatorAgentClient>;
  taskId: string;
  expectedStyle: string;
}): Promise<void> {
  const threads = await args.client.listMessageThreads({
    relatedTaskId: args.taskId,
    limit: 20,
  });

  if (!threads?.ok || !Array.isArray(threads.threads)) {
    return;
  }

  for (const thread of threads.threads) {
    if (!thread?.id) continue;
    const detail = await args.client.getMessageThread(thread.id);
    if (!detail?.ok || !Array.isArray(detail.messages)) continue;

    detail.messages.forEach((message: Record<string, unknown>, index: number) => {
      assertFieldsAbsent(
        message,
        FORBIDDEN_PERSONA_FIELDS,
        `/agent/message-threads/${thread.id}/messages[${index}]`,
      );
    });

    const publishedStyle = findPublishedRationaleMessageStyle(
      detail.messages as Record<string, unknown>[],
    );
    if (publishedStyle && publishedStyle !== args.expectedStyle) {
      throw new Error(
        `Thread rationale publication style mismatch for task ${args.taskId}: expected ${args.expectedStyle}, received ${publishedStyle}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const employeeIdsByKey = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "productManager",
        roleId: "product-manager-web",
        teamId: "team_web_product",
        runtimeStatus: "implemented",
        required: {
          scope: {
            allowedServices: ["service_dashboard"],
            allowedEnvironmentNames: ["preview"],
          },
        },
      },
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
      },
    ],
  });
  const { pmSample, validationSample } = await findPersonaSamples(
    client,
    {
      productManager: employeeIdsByKey.productManager,
      reliabilityEngineer: employeeIdsByKey.reliabilityEngineer,
    },
  );

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

  const pmStyle = extractPresentationStyleFromArtifact(pmSample.artifact);
  const validationStyle = extractPresentationStyleFromArtifact(
    validationSample.artifact,
  );

  if (!pmStyle) {
    throw new Error(
      `PM rationale artifact for task ${pmSample.taskId} is missing presentationStyle`,
    );
  }

  if (pmStyle !== EXPECTED_PM_STYLE) {
    throw new Error(
      `PM rationale artifact for task ${pmSample.taskId} expected ${EXPECTED_PM_STYLE} but received ${pmStyle}`,
    );
  }

  if (!validationStyle) {
    throw new Error(
      `Validation rationale artifact for task ${validationSample.taskId} is missing presentationStyle`,
    );
  }

  if (validationStyle !== EXPECTED_VALIDATION_STYLE) {
    throw new Error(
      `Validation rationale artifact for task ${validationSample.taskId} expected ${EXPECTED_VALIDATION_STYLE} but received ${validationStyle}`,
    );
  }

  await assertThreadStyleConsistency({
    client,
    taskId: pmSample.taskId,
    expectedStyle: pmStyle,
  });

  await assertThreadStyleConsistency({
    client,
    taskId: validationSample.taskId,
    expectedStyle: validationStyle,
  });

  console.log("employee-persona-continuity-check passed", {
    pmTaskId: pmSample.taskId,
    validationTaskId: validationSample.taskId,
    pmStyle,
    validationStyle,
  });
}

main().catch((error) => {
  console.error("employee-persona-continuity-check failed", error);
  process.exit(1);
});