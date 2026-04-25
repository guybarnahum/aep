import type { TaskArtifactType } from "./store-types";
import {
  TEAM_INFRA,
  TEAM_VALIDATION,
  TEAM_WEB_PRODUCT,
  type TeamId,
} from "../org/teams";
import type { AgentRoleId } from "../types";

export type TaskDiscipline =
  | "pm"
  | "web"
  | "infra"
  | "validation"
  | "coordination";

export type CanonicalTaskType =
  | "project_planning"
  | "requirements_definition"
  | "task_graph_planning"
  | "web_design"
  | "web_implementation"
  | "ui_iteration"
  | "deployment"
  | "monitoring_setup"
  | "incident_response"
  | "test_execution"
  | "bug_report"
  | "verification"
  | "coordination"
  | "analysis";

export type TaskContract = {
  taskType: CanonicalTaskType;
  discipline: TaskDiscipline;
  expectedTeamIds: readonly TeamId[];
  expectedArtifacts: readonly TaskArtifactType[];
  payloadContract: TaskPayloadContract;
  delegation?: TaskDelegationContract;
  legacyAliases?: readonly string[];
  defaultRoleId?: AgentRoleId;
};

export type TaskDelegationContract = {
  allowedNextTaskTypes: readonly CanonicalTaskType[];
};

export type TaskPayloadPrimitive =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export type TaskPayloadFieldContract = {
  key: string;
  type?: TaskPayloadPrimitive;
};

export type TaskPayloadContract = {
  required: readonly TaskPayloadFieldContract[];
  optional?: readonly TaskPayloadFieldContract[];
};

export class TaskPayloadValidationError extends Error {
  readonly taskType: string;
  readonly code:
    | "missing_required_payload_field"
    | "invalid_payload_field_type";
  readonly field: string;
  readonly expectedType?: TaskPayloadPrimitive;

  constructor(args: {
    taskType: string;
    code: TaskPayloadValidationError["code"];
    field: string;
    expectedType?: TaskPayloadPrimitive;
  }) {
    super(
      args.code === "missing_required_payload_field"
        ? `Task ${args.taskType} missing required payload field: ${args.field}`
        : `Task ${args.taskType} payload field ${args.field} must be ${args.expectedType}`,
    );
    this.name = "TaskPayloadValidationError";
    this.taskType = args.taskType;
    this.code = args.code;
    this.field = args.field;
    this.expectedType = args.expectedType;
  }
}

function field(key: string, type?: TaskPayloadPrimitive): TaskPayloadFieldContract {
  return { key, type };
}

function payloadContract(
  required: readonly TaskPayloadFieldContract[],
  optional: readonly TaskPayloadFieldContract[] = [],
): TaskPayloadContract {
  return { required, optional };
}

export const TASK_CONTRACTS: readonly TaskContract[] = [
  {
    taskType: "project_planning",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
    payloadContract: payloadContract([field("objectiveTitle", "string")]),
  },
  {
    taskType: "requirements_definition",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
    payloadContract: payloadContract([
      field("objectiveTitle", "string"),
      field("sourceRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["web_design", "web_implementation"],
    },
  },
  {
    taskType: "task_graph_planning",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
    payloadContract: payloadContract([
      field("objectiveTitle", "string"),
      field("targetUrl", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: [
        "requirements_definition",
        "web_design",
        "web_implementation",
        "coordination",
      ],
    },
    legacyAliases: ["plan-website-delivery", "plan-feature"],
  },
  {
    taskType: "web_design",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
    payloadContract: payloadContract([
      field("targetUrl", "string"),
      field("objectiveTitle", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["web_implementation", "ui_iteration"],
    },
    legacyAliases: ["website-design"],
  },
  {
    taskType: "web_implementation",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
    payloadContract: payloadContract([
      field("targetUrl", "string"),
      field("requirementsRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["deployment", "ui_iteration", "verification"],
    },
    legacyAliases: ["website-implementation", "implementation"],
  },
  {
    taskType: "ui_iteration",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
    payloadContract: payloadContract([
      field("targetUrl", "string"),
      field("feedbackRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["web_implementation", "verification"],
    },
  },
  {
    taskType: "deployment",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
    payloadContract: payloadContract([
      field("environment", "string"),
      field("artifactRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: [
        "verification",
        "monitoring_setup",
        "incident_response",
      ],
    },
    legacyAliases: ["website-deployment"],
  },
  {
    taskType: "monitoring_setup",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
    payloadContract: payloadContract([
      field("environment", "string"),
      field("targetUrl", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["verification", "incident_response"],
    },
  },
  {
    taskType: "incident_response",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
    payloadContract: payloadContract([
      field("incidentRef", "string"),
      field("severity", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["bug_report", "verification", "coordination"],
    },
  },
  {
    taskType: "test_execution",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result", "evidence"],
    payloadContract: payloadContract([
      field("targetUrl", "string"),
      field("testPlanRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["bug_report", "verification", "coordination"],
    },
  },
  {
    taskType: "bug_report",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result"],
    payloadContract: payloadContract([
      field("sourceTaskId", "string"),
      field("summary", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: [
        "requirements_definition",
        "web_implementation",
        "deployment",
        "coordination",
      ],
    },
  },
  {
    taskType: "verification",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result", "evidence"],
    payloadContract: payloadContract([
      field("targetUrl", "string"),
      field("subjectRef", "string"),
    ]),
    delegation: {
      allowedNextTaskTypes: ["bug_report", "deployment", "coordination"],
    },
    legacyAliases: ["validate-deployment"],
    defaultRoleId: "reliability-engineer",
  },
  {
    taskType: "coordination",
    discipline: "coordination",
    expectedTeamIds: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    expectedArtifacts: ["result"],
    payloadContract: payloadContract([field("topic", "string")]),
    delegation: {
      allowedNextTaskTypes: [
        "project_planning",
        "requirements_definition",
        "web_design",
        "web_implementation",
        "deployment",
        "test_execution",
        "verification",
        "analysis",
      ],
    },
  },
  {
    taskType: "analysis",
    discipline: "coordination",
    expectedTeamIds: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    expectedArtifacts: ["plan"],
    payloadContract: payloadContract([field("question", "string")]),
    delegation: {
      allowedNextTaskTypes: [
        "coordination",
        "requirements_definition",
        "web_implementation",
        "deployment",
        "verification",
      ],
    },
  },
] as const;

const CONTRACT_BY_TYPE = new Map(
  TASK_CONTRACTS.map((contract) => [contract.taskType, contract]),
);

const TASK_TYPE_PRIORITY_ORDER: readonly CanonicalTaskType[] = [
  "project_planning",
  "requirements_definition",
  "task_graph_planning",
  "web_design",
  "web_implementation",
  "ui_iteration",
  "deployment",
  "monitoring_setup",
  "incident_response",
  "test_execution",
  "bug_report",
  "verification",
  "coordination",
  "analysis",
];

const TASK_TYPE_PRIORITY_BY_TYPE = new Map<CanonicalTaskType, number>(
  TASK_TYPE_PRIORITY_ORDER.map((taskType, index) => [taskType, index]),
);

const DISCIPLINE_PRIORITY_BY_TEAM: Record<TeamId, readonly TaskDiscipline[]> = {
  [TEAM_WEB_PRODUCT]: ["pm", "web", "coordination", "infra", "validation"],
  [TEAM_INFRA]: ["infra", "coordination", "validation", "web", "pm"],
  [TEAM_VALIDATION]: ["validation", "coordination", "infra", "web", "pm"],
};

const TYPE_BY_ALIAS = new Map<string, CanonicalTaskType>(
  TASK_CONTRACTS.flatMap((contract) =>
    (contract.legacyAliases ?? []).map((alias) => [alias, contract.taskType] as const),
  ),
);

export class TaskTypeValidationError extends Error {
  readonly taskType: string;

  constructor(taskType: string) {
    super(`Unsupported taskType: ${taskType}`);
    this.name = "TaskTypeValidationError";
    this.taskType = taskType;
  }
}

export function normalizeTaskType(taskType: string): CanonicalTaskType {
  const normalized = TYPE_BY_ALIAS.get(taskType) ?? taskType;

  if (!CONTRACT_BY_TYPE.has(normalized as CanonicalTaskType)) {
    throw new TaskTypeValidationError(taskType);
  }

  return normalized as CanonicalTaskType;
}

export function getTaskContract(taskType: string): TaskContract {
  const canonicalTaskType = normalizeTaskType(taskType);
  const contract = CONTRACT_BY_TYPE.get(canonicalTaskType);

  if (!contract) {
    throw new TaskTypeValidationError(taskType);
  }

  return contract;
}

export function getDefaultRoleIdForTaskType(taskType: string): AgentRoleId | undefined {
  return getTaskContract(taskType).defaultRoleId;
}

export function getTaskDiscipline(taskType: string): TaskDiscipline {
  return getTaskContract(taskType).discipline;
}

export function isTaskExpectedForTeam(taskType: string, teamId: TeamId): boolean {
  return getTaskContract(taskType).expectedTeamIds.includes(teamId);
}

export function getTaskTypePriority(taskType: string): number {
  const canonicalTaskType = normalizeTaskType(taskType);
  return TASK_TYPE_PRIORITY_BY_TYPE.get(canonicalTaskType) ?? Number.MAX_SAFE_INTEGER;
}

export function getTeamDisciplinePriority(args: {
  teamId: TeamId;
  taskType: string;
}): number {
  const contract = getTaskContract(args.taskType);
  const priorities = DISCIPLINE_PRIORITY_BY_TEAM[args.teamId];
  const index = priorities.indexOf(contract.discipline);

  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function actualPayloadType(value: unknown): TaskPayloadPrimitive | undefined {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return undefined;
}

function assertPayloadField(args: {
  taskType: CanonicalTaskType;
  payload: Record<string, unknown>;
  field: TaskPayloadFieldContract;
  required: boolean;
}): void {
  const value = args.payload[args.field.key];

  if (typeof value === "undefined" || value === null || value === "") {
    if (args.required) {
      throw new TaskPayloadValidationError({
        taskType: args.taskType,
        code: "missing_required_payload_field",
        field: args.field.key,
        expectedType: args.field.type,
      });
    }
    return;
  }

  if (args.field.type && actualPayloadType(value) !== args.field.type) {
    throw new TaskPayloadValidationError({
      taskType: args.taskType,
      code: "invalid_payload_field_type",
      field: args.field.key,
      expectedType: args.field.type,
    });
  }
}

export function validateTaskPayloadContract(args: {
  taskType: string;
  payload: Record<string, unknown>;
}): CanonicalTaskType {
  const contract = getTaskContract(args.taskType);

  for (const requiredField of contract.payloadContract.required) {
    assertPayloadField({
      taskType: contract.taskType,
      payload: args.payload,
      field: requiredField,
      required: true,
    });
  }

  for (const optionalField of contract.payloadContract.optional ?? []) {
    assertPayloadField({
      taskType: contract.taskType,
      payload: args.payload,
      field: optionalField,
      required: false,
    });
  }

  return contract.taskType;
}

export type TaskArtifactExpectationStatus =
  | "satisfied"
  | "missing_expected_artifacts";

export type TaskArtifactExpectationResult = {
  status: TaskArtifactExpectationStatus;
  taskType: CanonicalTaskType;
  expectedArtifacts: readonly TaskArtifactType[];
  presentArtifacts: readonly TaskArtifactType[];
  missingArtifacts: readonly TaskArtifactType[];
};

export function evaluateTaskArtifactExpectations(args: {
  taskType: string;
  artifactTypes: readonly TaskArtifactType[];
}): TaskArtifactExpectationResult {
  const contract = getTaskContract(args.taskType);
  const present = new Set(args.artifactTypes);
  const missingArtifacts = contract.expectedArtifacts.filter(
    (artifactType) => !present.has(artifactType),
  );

  return {
    status: missingArtifacts.length === 0
      ? "satisfied"
      : "missing_expected_artifacts",
    taskType: contract.taskType,
    expectedArtifacts: contract.expectedArtifacts,
    presentArtifacts: args.artifactTypes,
    missingArtifacts,
  };
}

export type TaskDelegationValidationResult =
  | { ok: true; sourceTaskType: CanonicalTaskType; delegatedTaskType: CanonicalTaskType }
  | {
    ok: false;
    sourceTaskType: CanonicalTaskType;
    delegatedTaskType: CanonicalTaskType;
    reason: "delegation_not_allowed";
    allowedNextTaskTypes: readonly CanonicalTaskType[];
  };

export function validateTaskDelegationPattern(args: {
  sourceTaskType: string;
  delegatedTaskType: string;
}): TaskDelegationValidationResult {
  const source = getTaskContract(args.sourceTaskType);
  const delegated = getTaskContract(args.delegatedTaskType);
  const allowedNextTaskTypes = source.delegation?.allowedNextTaskTypes ?? [];

  if (!allowedNextTaskTypes.includes(delegated.taskType)) {
    return {
      ok: false,
      sourceTaskType: source.taskType,
      delegatedTaskType: delegated.taskType,
      reason: "delegation_not_allowed",
      allowedNextTaskTypes,
    };
  }

  return {
    ok: true,
    sourceTaskType: source.taskType,
    delegatedTaskType: delegated.taskType,
  };
}
