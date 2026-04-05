import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { D1ApprovalStore } from "@aep/operator-agent/lib/approval-store-d1";
import { D1EmployeeControlHistoryStore } from "@aep/operator-agent/lib/control-history-log-d1";
import { D1EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store-d1";
import { D1EscalationStore } from "@aep/operator-agent/lib/escalation-log-d1";
import { D1ManagerDecisionStore } from "@aep/operator-agent/lib/manager-decision-log-d1";
import { D1TaskStore } from "@aep/operator-agent/lib/task-store-d1";
import { D1AgentWorkLogStore } from "@aep/operator-agent/lib/work-log-store-d1";
import type {
  IAgentWorkLogStore,
  IApprovalStore,
  IEmployeeControlHistoryStore,
  IEmployeeControlStore,
  IEscalationStore,
  IManagerDecisionStore,
  TaskStore,
} from "@aep/operator-agent/lib/store-types";

export interface OperatorAgentStores {
  approvals: IApprovalStore;
  employeeControls: IEmployeeControlStore;
  employeeControlHistory: IEmployeeControlHistoryStore;
  escalations: IEscalationStore;
  managerDecisions: IManagerDecisionStore;
  agentWorkLog: IAgentWorkLogStore;
  tasks: TaskStore;
}

export function createStores(env: OperatorAgentEnv): OperatorAgentStores {
  return {
    approvals: new D1ApprovalStore(env),
    employeeControls: new D1EmployeeControlStore(env),
    employeeControlHistory: new D1EmployeeControlHistoryStore(env),
    escalations: new D1EscalationStore(env),
    managerDecisions: new D1ManagerDecisionStore(env),
    agentWorkLog: new D1AgentWorkLogStore(env),
    tasks: new D1TaskStore(env),
  };
}

export function getTaskStore(env: OperatorAgentEnv): TaskStore {
  return new D1TaskStore(env);
}
