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
  legacyAliases?: readonly string[];
  defaultRoleId?: AgentRoleId;
};

export const TASK_CONTRACTS: readonly TaskContract[] = [
  {
    taskType: "project_planning",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
  },
  {
    taskType: "requirements_definition",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
  },
  {
    taskType: "task_graph_planning",
    discipline: "pm",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["plan"],
    legacyAliases: ["plan-website-delivery"],
  },
  {
    taskType: "web_design",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
    legacyAliases: ["website-design"],
  },
  {
    taskType: "web_implementation",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
    legacyAliases: ["website-implementation"],
  },
  {
    taskType: "ui_iteration",
    discipline: "web",
    expectedTeamIds: [TEAM_WEB_PRODUCT],
    expectedArtifacts: ["result"],
  },
  {
    taskType: "deployment",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
    legacyAliases: ["website-deployment"],
  },
  {
    taskType: "monitoring_setup",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
  },
  {
    taskType: "incident_response",
    discipline: "infra",
    expectedTeamIds: [TEAM_INFRA],
    expectedArtifacts: ["evidence"],
  },
  {
    taskType: "test_execution",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result", "evidence"],
  },
  {
    taskType: "bug_report",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result"],
  },
  {
    taskType: "verification",
    discipline: "validation",
    expectedTeamIds: [TEAM_VALIDATION],
    expectedArtifacts: ["result", "evidence"],
    legacyAliases: ["validate-deployment"],
    defaultRoleId: "reliability-engineer",
  },
  {
    taskType: "coordination",
    discipline: "coordination",
    expectedTeamIds: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    expectedArtifacts: ["result"],
  },
  {
    taskType: "analysis",
    discipline: "coordination",
    expectedTeamIds: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    expectedArtifacts: ["plan"],
  },
] as const;

const CONTRACT_BY_TYPE = new Map(
  TASK_CONTRACTS.map((contract) => [contract.taskType, contract]),
);

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
