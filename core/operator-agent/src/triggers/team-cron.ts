import { runTeamWorkLoop } from "@aep/operator-agent/lib/team-work-loop";
import { TEAM_IDS } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleTeamCron(env: OperatorAgentEnv): Promise<void> {
  for (const teamId of TEAM_IDS) {
    try {
      const result = await runTeamWorkLoop({
        env,
        teamId,
      });

      console.log("[operator-agent] team cron completed", {
        teamId: result.teamId,
        status: result.status,
        taskId: result.taskId,
        employeeId: result.employeeId,
        roleId: result.roleId,
        pendingTasks: result.scanned.pendingTasks,
        eligibleTasks: result.scanned.eligibleTasks,
      });
    } catch (error) {
      console.error("[operator-agent] team cron failed", {
        teamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}