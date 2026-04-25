import { resolveRuntimeEmployeeByRole } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import { getDefaultRoleIdForTaskType } from "@aep/operator-agent/lib/task-contracts";
import type { AgentRoleId, OperatorAgentEnv } from "@aep/operator-agent/types";

export type OrgCapability =
  | "design"
  | "implementation"
  | "deployment"
  | "validation";

export interface ResolvedCapabilityOwner {
  capability: OrgCapability;
  teamId: string;
}

export interface ResolvedTaskAssignee {
  employeeId?: string;
}

export interface OrgResolver {
  resolveTeamForCapability(
    companyId: string,
    capability: OrgCapability,
  ): Promise<ResolvedCapabilityOwner>;

  resolveEmployeeForTask(args: {
    companyId: string;
    teamId: string;
    taskType: string;
  }): Promise<ResolvedTaskAssignee>;
}

const DEFAULT_CAPABILITY_TEAM_MAP: Record<OrgCapability, string> = {
  design: "team_web_product",
  implementation: "team_web_product",
  deployment: "team_infra",
  validation: "team_validation",
};

function defaultRoleForTask(args: {
  taskType: string;
}): AgentRoleId | undefined {
  return getDefaultRoleIdForTaskType(args.taskType);
}

async function lookupCapabilityTeamInDb(args: {
  env?: OperatorAgentEnv;
  companyId: string;
  capability: OrgCapability;
}): Promise<string | null> {
  if (!args.env?.OPERATOR_AGENT_DB) {
    return null;
  }

  try {
    const row = await args.env.OPERATOR_AGENT_DB.prepare(
      `
        SELECT team_id
        FROM team_capabilities
        WHERE company_id = ?
          AND capability = ?
        LIMIT 1
      `,
    )
      .bind(args.companyId, args.capability)
      .first<{ team_id: string }>();

    return row?.team_id ?? null;
  } catch {
    // Table may not exist yet during bridge phase.
    return null;
  }
}

export function createOrgResolver(
  env?: OperatorAgentEnv,
): OrgResolver {
  return {
    async resolveTeamForCapability(
      companyId: string,
      capability: OrgCapability,
    ): Promise<ResolvedCapabilityOwner> {
      const dbTeamId = await lookupCapabilityTeamInDb({
        env,
        companyId,
        capability,
      });

      return {
        capability,
        teamId: dbTeamId ?? DEFAULT_CAPABILITY_TEAM_MAP[capability],
      };
    },

    async resolveEmployeeForTask(args: {
      companyId: string;
      teamId: string;
      taskType: string;
    }): Promise<ResolvedTaskAssignee> {
      const roleId = defaultRoleForTask({
        taskType: args.taskType,
      });

      if (!roleId || !env?.OPERATOR_AGENT_DB) {
        return {};
      }

      const employee = await resolveRuntimeEmployeeByRole({
        env,
        companyId: args.companyId as Parameters<typeof resolveRuntimeEmployeeByRole>[0]["companyId"],
        teamId: args.teamId as Parameters<typeof resolveRuntimeEmployeeByRole>[0]["teamId"],
        roleId,
      });

      return {
        employeeId: employee?.identity.employeeId,
      };
    },
  };
}

