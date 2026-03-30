import type { OperatorAgentEnv, OperatorAgentStoreBackend } from "@aep/operator-agent/types";
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
  // Stage 1 keeps runtime behavior unchanged by using KV adapters
  // for every backend mode until D1 stores are wired in a follow-up slice.
  void getStoreBackend(env);

  return {
    approvals: new KvApprovalStoreAdapter(env),
    employeeControls: new KvEmployeeControlStoreAdapter(env),
    employeeControlHistory: new KvEmployeeControlHistoryStoreAdapter(env),
    escalations: new KvEscalationStoreAdapter(env),
    managerDecisions: new KvManagerDecisionStoreAdapter(env),
    agentWorkLog: new KvAgentWorkLogStoreAdapter(env),
  };
}
