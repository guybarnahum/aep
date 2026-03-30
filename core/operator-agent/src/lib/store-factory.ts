import type { OperatorAgentEnv, OperatorAgentStoreBackend } from "@aep/operator-agent/types";
import { D1ApprovalStore } from "@aep/operator-agent/lib/approval-store-d1";
import { DualApprovalStore } from "@aep/operator-agent/lib/approval-store-dual";
import { D1EmployeeControlHistoryStore } from "@aep/operator-agent/lib/control-history-log-d1";
import { DualEmployeeControlHistoryStore } from "@aep/operator-agent/lib/control-history-log-dual";
import { D1EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store-d1";
import { DualEmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store-dual";
import { D1EscalationStore } from "@aep/operator-agent/lib/escalation-log-d1";
import { DualEscalationStore } from "@aep/operator-agent/lib/escalation-log-dual";
import {
  KvAgentWorkLogStoreAdapter,
  KvApprovalStoreAdapter,
  KvEmployeeControlHistoryStoreAdapter,
  KvEmployeeControlStoreAdapter,
  KvEscalationStoreAdapter,
  KvManagerDecisionStoreAdapter,
} from "@aep/operator-agent/lib/kv-store-adapters";
import { resolveOperatorAgentStoreBackend } from "@aep/operator-agent/lib/store-backend";
import type {
  IAgentWorkLogStore,
  IApprovalStore,
  IEmployeeControlHistoryStore,
  IEmployeeControlStore,
  IEscalationStore,
  IManagerDecisionStore,
} from "@aep/operator-agent/lib/store-types";

export interface OperatorAgentStores {
  approvals: IApprovalStore;
  employeeControls: IEmployeeControlStore;
  employeeControlHistory: IEmployeeControlHistoryStore;
  escalations: IEscalationStore;
  managerDecisions: IManagerDecisionStore;
  agentWorkLog: IAgentWorkLogStore;
}

export function getStoreBackend(env: OperatorAgentEnv): OperatorAgentStoreBackend {
  return resolveOperatorAgentStoreBackend(env);
}

export function createStores(env: OperatorAgentEnv): OperatorAgentStores {
  const backend = getStoreBackend(env);

  return {
    approvals:
      backend === "d1"
        ? new D1ApprovalStore(env)
        : backend === "dual"
          ? new DualApprovalStore(env)
          : new KvApprovalStoreAdapter(env),
    employeeControls:
      backend === "d1"
        ? new D1EmployeeControlStore(env)
        : backend === "dual"
          ? new DualEmployeeControlStore(env)
          : new KvEmployeeControlStoreAdapter(env),
    employeeControlHistory:
      backend === "d1"
        ? new D1EmployeeControlHistoryStore(env)
        : backend === "dual"
          ? new DualEmployeeControlHistoryStore(env)
          : new KvEmployeeControlHistoryStoreAdapter(env),
    escalations:
      backend === "d1"
        ? new D1EscalationStore(env)
        : backend === "dual"
          ? new DualEscalationStore(env)
          : new KvEscalationStoreAdapter(env),
    managerDecisions: new KvManagerDecisionStoreAdapter(env),
    agentWorkLog: new KvAgentWorkLogStoreAdapter(env),
  };
}
