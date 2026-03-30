import type { OperatorAgentEnv, OperatorAgentStoreBackend } from "@aep/operator-agent/types";
import { D1ApprovalStore } from "@aep/operator-agent/lib/approval-store-d1";
import { DualApprovalStore } from "@aep/operator-agent/lib/approval-store-dual";
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
    employeeControls: new KvEmployeeControlStoreAdapter(env),
    employeeControlHistory: new KvEmployeeControlHistoryStoreAdapter(env),
    escalations: new KvEscalationStoreAdapter(env),
    managerDecisions: new KvManagerDecisionStoreAdapter(env),
    agentWorkLog: new KvAgentWorkLogStoreAdapter(env),
  };
}
