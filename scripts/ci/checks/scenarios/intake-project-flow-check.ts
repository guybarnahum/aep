/* eslint-disable no-console */

import { getJson, postJson, readJson } from "../../shared/http";
import { ciActor, ciArtifactMarker } from "../../shared/ci-artifacts";

const CHECK_NAME = "intake-project-flow-check";

type IntakeStatus = "submitted" | "triaged" | "converted" | "rejected";

type IntakeRecord = {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  requestedBy: string;
  source: string;
  status: IntakeStatus;
  createdAt: string;
};

type ProjectRecord = {
  id: string;
  companyId: string;
  intakeRequestId?: string | null;
  title: string;
  description?: string | null;
  ownerTeamId: string;
  status: "active" | "paused" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
};

type TaskRecord = {
  id: string;
  companyId: string;
  originatingTeamId: string;
  assignedTeamId: string;
  createdByEmployeeId?: string;
  taskType: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  blockingDependencyCount: number;
};

type TaskDetail = {
  ok: true;
  task: TaskRecord;
  dependencies: Array<{
    taskId: string;
    dependsOnTaskId: string;
    dependencyType: "completion";
  }>;
};

function requireOperatorAgentBaseUrl(): string {
  const baseUrl = process.env.OPERATOR_AGENT_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("OPERATOR_AGENT_BASE_URL is required for intake project flow check");
  }
  return baseUrl;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return readJson<T>(response);
}

async function expectRequestFailure(
  label: string,
  request: () => Promise<unknown>,
): Promise<void> {
  let failed = false;
  try {
    await request();
  } catch {
    failed = true;
  }

  assert(failed, `${label} should fail`);
}

async function resolveEmployeeAuthor(baseUrl: string): Promise<string> {
  const payload = await getJson<{
    employees?: Array<{
      identity?: {
        employeeId?: string;
        teamId?: string;
        roleId?: string;
      };
      runtime?: {
        runtimeStatus?: string;
      };
      employment?: {
        employmentStatus?: string;
      };
    }>;
  }>(`${baseUrl}/agent/employees`);

  const employee = (payload.employees ?? []).find((candidate) => {
    return (
      candidate.identity?.employeeId &&
      candidate.employment?.employmentStatus === "active" &&
      candidate.runtime?.runtimeStatus === "implemented"
    );
  });

  assert(employee?.identity?.employeeId, "No active implemented employee found for PR15 authoring check");
  return employee.identity.employeeId;
}

async function main(): Promise<void> {
  const baseUrl = requireOperatorAgentBaseUrl();
  const authorEmployeeId = await resolveEmployeeAuthor(baseUrl);

  const root = await getJson<{
    ok: true;
    links?: Record<string, string>;
  }>(`${baseUrl}/`);

  assert(root.links?.intake === "/agent/intake", "root does not advertise intake route");
  assert(root.links?.projects === "/agent/projects", "root does not advertise projects route");

  const unique = Date.now();
  const title = `PR15F CI Intake ${unique}`;

  const createdIntakePayload = await postJson<{
    ok: true;
    intake: IntakeRecord;
  }>(`${baseUrl}/agent/intake`, {
    companyId: "company_internal_aep",
    title,
    description: "CI-created intake for PR15F canonical flow validation.",
    requestedBy: ciActor(CHECK_NAME),
    source: "ci",
  });

  const intake = createdIntakePayload.intake;
  assert(intake.status === "submitted", "new intake should start submitted");

  const fetchedIntake = await getJson<{
    ok: true;
    item: IntakeRecord;
  }>(`${baseUrl}/agent/intake/${encodeURIComponent(intake.id)}`);
  assert(fetchedIntake.item.id === intake.id, "intake get should return created intake");

  const listedIntake = await getJson<{
    ok: true;
    items: IntakeRecord[];
  }>(`${baseUrl}/agent/intake?companyId=company_internal_aep&limit=100`);
  assert(
    listedIntake.items.some((item) => item.id === intake.id),
    "intake list should include created intake",
  );

  const triaged = await patchJson<{
    ok: true;
    item: IntakeRecord;
  }>(`${baseUrl}/agent/intake/${encodeURIComponent(intake.id)}`, {
    status: "triaged",
  });
  assert(triaged.item.status === "triaged", "intake patch should update status to triaged");

  const directProjectPayload = await postJson<{
    ok: true;
    project: ProjectRecord;
  }>(`${baseUrl}/agent/projects`, {
    companyId: "company_internal_aep",
    title: `PR15F Direct Project ${unique}`,
    description: "CI-created direct project for route contract validation.",
    ownerTeamId: "team_web_product",
  });

  assert(directProjectPayload.project.status === "active", "direct project should start active");

  const conversionPayload = await postJson<{
    ok: true;
    intake: IntakeRecord;
    project: ProjectRecord;
    threadId: string;
    messageId: string;
  }>(`${baseUrl}/agent/intake/${encodeURIComponent(intake.id)}/convert-to-project`, {
    convertedByEmployeeId: authorEmployeeId,
    ownerTeamId: "team_web_product",
    projectTitle: `PR15F Converted Project ${unique}`,
    projectDescription: "CI-created project converted from intake.",
    rationale: "Public CI rationale for validating intake conversion.",
  });

  assert(conversionPayload.intake.status === "converted", "conversion should mark intake converted");
  assert(
    conversionPayload.project.intakeRequestId === intake.id,
    "converted project should link to intake",
  );
  assert(conversionPayload.threadId, "conversion should return threadId");
  assert(conversionPayload.messageId, "conversion should return messageId");

  await expectRequestFailure("double conversion", () =>
    postJson(`${baseUrl}/agent/intake/${encodeURIComponent(intake.id)}/convert-to-project`, {
      convertedByEmployeeId: authorEmployeeId,
    }),
  );

  await expectRequestFailure("invalid project owner team", () =>
    postJson(`${baseUrl}/agent/projects`, {
      companyId: "company_internal_aep",
      title: `PR15F Invalid Project ${unique}`,
      ownerTeamId: "not_a_team",
    }),
  );

  const graphPayload = await postJson<{
    ok: true;
    project: ProjectRecord;
    taskIds: string[];
    taskCount: number;
    threadId: string;
    messageId: string;
  }>(`${baseUrl}/agent/projects/${encodeURIComponent(conversionPayload.project.id)}/task-graph`, {
    createdByEmployeeId: authorEmployeeId,
    rationale: "Public CI rationale for validating project task graph creation.",
    tasks: [
      {
        clientTaskId: "requirements",
        title: `PR15F Define requirements ${unique}`,
        taskType: "requirements_definition",
        assignedTeamId: "team_web_product",
        payload: {
          ...ciArtifactMarker(CHECK_NAME),
          objectiveTitle: `PR15F requirements objective ${unique}`,
          sourceRef: `intake:${intake.id}`,
        },
      },
      {
        clientTaskId: "implementation",
        title: `PR15F Implement deliverable ${unique}`,
        taskType: "web_implementation",
        assignedTeamId: "team_web_product",
        dependsOnClientTaskIds: ["requirements"],
        payload: {
          ...ciArtifactMarker(CHECK_NAME),
          targetUrl: "https://example.invalid/pr15f/implementation",
          requirementsRef: "requirements",
        },
      },
      {
        clientTaskId: "deploy",
        title: `PR15F Deploy deliverable ${unique}`,
        taskType: "deployment",
        assignedTeamId: "team_infra",
        dependsOnClientTaskIds: ["implementation"],
        payload: {
          ...ciArtifactMarker(CHECK_NAME),
          environment: "staging",
          artifactRef: "build_pr15f_fixture",
        },
      },
      {
        clientTaskId: "validate",
        title: `PR15F Validate deliverable ${unique}`,
        taskType: "verification",
        assignedTeamId: "team_validation",
        dependsOnClientTaskIds: ["deploy"],
        payload: {
          ...ciArtifactMarker(CHECK_NAME),
          targetUrl: "https://example.invalid/pr15f/verification",
          subjectRef: "deploy",
        },
      },
    ],
  });

  assert(graphPayload.taskCount === 4, `expected 4 task graph tasks, got ${graphPayload.taskCount}`);
  assert(graphPayload.taskIds.length === 4, "task graph should return four task IDs");
  assert(graphPayload.threadId, "task graph should return threadId");
  assert(graphPayload.messageId, "task graph should return messageId");

  const taskDetails = await Promise.all(
    graphPayload.taskIds.map((taskId) =>
      getJson<TaskDetail>(`${baseUrl}/agent/tasks/${encodeURIComponent(taskId)}`),
    ),
  );

  for (const detail of taskDetails) {
    assert(
      detail.task.payload.projectId === conversionPayload.project.id,
      `task ${detail.task.id} missing projectId payload link`,
    );
    assert(
      detail.task.payload.intakeRequestId === intake.id,
      `task ${detail.task.id} missing intakeRequestId payload link`,
    );
    assert(
      typeof detail.task.payload.projectTaskClientId === "string",
      `task ${detail.task.id} missing projectTaskClientId`,
    );
  }

  const requirements = taskDetails.find(
    (detail) => detail.task.payload.projectTaskClientId === "requirements",
  );
  const implementation = taskDetails.find(
    (detail) => detail.task.payload.projectTaskClientId === "implementation",
  );

  assert(requirements, "requirements task should exist");
  assert(implementation, "implementation task should exist");
  assert(requirements.dependencies.length === 0, "requirements should have no dependencies");
  assert(
    implementation.dependencies.some(
      (dependency) => dependency.dependsOnTaskId === requirements.task.id,
    ),
    "implementation should depend on requirements",
  );

  await expectRequestFailure("unknown task graph dependency", () =>
    postJson(
      `${baseUrl}/agent/projects/${encodeURIComponent(conversionPayload.project.id)}/task-graph`,
      {
        createdByEmployeeId: authorEmployeeId,
        tasks: [
          {
            clientTaskId: "bad",
            title: "Bad dependency",
            taskType: "bad_dependency",
            assignedTeamId: "team_web_product",
            dependsOnClientTaskIds: ["missing"],
          },
        ],
      },
    ),
  );

  console.log("- PASS: root advertises intake and project routes");
  console.log("- PASS: intake create/list/get/status update");
  console.log("- PASS: direct project create");
  console.log("- PASS: intake conversion creates linked project and coordination references");
  console.log("- PASS: project task graph creates canonical linked tasks and dependencies");
  console.log("- PASS: negative cases reject invalid owner team, double conversion, and unknown dependencies");
}

void main().catch((error) => {
  console.error("- FAIL: intake project flow check failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});