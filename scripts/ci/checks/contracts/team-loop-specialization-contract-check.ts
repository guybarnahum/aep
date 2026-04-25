/* eslint-disable no-console */

import { TEAM_IDS } from "../../../../core/operator-agent/src/org/teams";
import {
  TASK_CONTRACTS,
  getTaskDiscipline,
  getTaskTypePriority,
  getTeamDisciplinePriority,
  isTaskExpectedForTeam,
} from "../../../../core/operator-agent/src/lib/task-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

for (const contract of TASK_CONTRACTS) {
  const discipline = getTaskDiscipline(contract.taskType);
  assert(
    discipline === contract.discipline,
    `Discipline mismatch for ${contract.taskType}: ${discipline} != ${contract.discipline}`,
  );

  const typePriority = getTaskTypePriority(contract.taskType);
  assert(Number.isFinite(typePriority), `Missing type priority for ${contract.taskType}`);

  for (const teamId of TEAM_IDS) {
    const expected = contract.expectedTeamIds.includes(teamId);
    const actual = isTaskExpectedForTeam(contract.taskType, teamId);
    assert(
      expected === actual,
      `Team expectation mismatch for ${contract.taskType}/${teamId}: ${actual} != ${expected}`,
    );

    const teamPriority = getTeamDisciplinePriority({
      teamId,
      taskType: contract.taskType,
    });
    assert(
      Number.isFinite(teamPriority),
      `Discipline priority must be finite for ${contract.taskType}/${teamId}`,
    );
  }
}

assert(
  getTaskTypePriority("web_design") < getTaskTypePriority("web_implementation"),
  "Expected web_design to be prioritized before web_implementation",
);
assert(
  getTaskTypePriority("deployment") < getTaskTypePriority("verification"),
  "Expected deployment to be prioritized before verification",
);

console.log("team-loop-specialization-contract-check passed", {
  contractCount: TASK_CONTRACTS.length,
});
