import type {
  OperatorAgentEnv,
  OperatorAgentStoreBackend,
} from "@aep/operator-agent/types";

const VALID_BACKENDS: OperatorAgentStoreBackend[] = ["kv", "dual", "d1"];

export function resolveOperatorAgentStoreBackend(
  env: OperatorAgentEnv
): OperatorAgentStoreBackend {
  const raw = (env.OPERATOR_AGENT_STORE_BACKEND ?? "kv").toLowerCase();
  if ((VALID_BACKENDS as string[]).includes(raw)) {
    return raw as OperatorAgentStoreBackend;
  }
  return "kv";
}
