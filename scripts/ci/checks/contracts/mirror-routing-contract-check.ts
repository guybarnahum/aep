/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { dispatchMessageMirrors } from "../../../../core/operator-agent/src/adapters/mirror-dispatcher";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorDeliveryRecord,
} from "../../../../core/operator-agent/src/adapters/types";

export {};

const FIXTURE_PRODUCT_MANAGER_ID = "fixture_product_manager";
const FIXTURE_INFRA_OPS_MANAGER_ID = "fixture_infra_ops_manager";
const FIXTURE_RELIABILITY_ENGINEER_ID = "fixture_reliability_engineer";

type EnvShape = {
  OPERATOR_AGENT_DB?: {
    prepare: (query: string) => {
      all: <T>() => Promise<{ results: T[] }>;
    };
  };
  MIRROR_DEFAULT_SLACK_CHANNEL?: string;
  MIRROR_APPROVALS_SLACK_CHANNEL?: string;
  MIRROR_ESCALATIONS_SLACK_CHANNEL?: string;
  MIRROR_ESCALATIONS_EMAIL_GROUP?: string;
  SLACK_MIRROR_WEBHOOK_URL?: string;
};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const rulesResponse = await fetch(`${agentBaseUrl}/agent/mirror-routing-rules`);
  if (!rulesResponse.ok) {
    throw new Error("Expected /agent/mirror-routing-rules to be available");
  }

  const rulesPayload = (await rulesResponse.json()) as {
    ok?: boolean;
    rules?: Array<{ ruleId?: string; targetAdapter?: string; targetKey?: string }>;
  };

  if (rulesPayload.ok !== true || !Array.isArray(rulesPayload.rules)) {
    throw new Error("Expected mirror routing rules response shape");
  }

  for (const rule of rulesPayload.rules) {
    if (!rule.ruleId || !rule.targetAdapter || !rule.targetKey) {
      throw new Error(`Invalid mirror routing rule: ${JSON.stringify(rule)}`);
    }

    if (String(rule.targetKey).includes("example.com")) {
      throw new Error(
        `Mirror routing rule must not use placeholder recipient: ${rule.targetKey}`,
      );
    }
  }

  const configuredEnv: EnvShape = {
    OPERATOR_AGENT_DB: {
      prepare() {
        return {
          async all<T>() {
            return {
              results: [
                {
                  rule_id: "mirror_coordination_to_default_slack",
                  enabled: 1,
                  thread_kind: "coordination",
                  message_type: null,
                  severity: null,
                  visibility: null,
                  target_adapter: "slack",
                  target_key: "MIRROR_DEFAULT_SLACK_CHANNEL",
                },
              ] as T[],
            };
          },
        };
      },
    },
  };

  const deliveries: MirrorDeliveryRecord[] = [];
  const threadProjections: ExternalThreadProjection[] = [];
  const messageProjections: ExternalMessageProjection[] = [];
  await dispatchMessageMirrors({
    env: {} as any,
    store: {
      async createMessageMirrorDelivery(delivery: MirrorDeliveryRecord) {
        deliveries.push(delivery);
      },
      async getExternalThreadProjection() {
        return null;
      },
      async createExternalThreadProjection(projection: ExternalThreadProjection) {
        threadProjections.push(projection);
      },
      async createExternalMessageProjection(projection: ExternalMessageProjection) {
        messageProjections.push(projection);
      },
    } as any,
    input: {
      messageId: "msg_missing_config",
      threadId: "thr_missing_config",
      body: "Canonical agent-originated message",
      senderEmployeeId: FIXTURE_RELIABILITY_ENGINEER_ID,
      createdAt: new Date().toISOString(),
      routing: {
        threadId: "thr_missing_config",
        messageType: "coordination",
        senderEmployeeId: FIXTURE_RELIABILITY_ENGINEER_ID,
        humanVisibilityRequired: true,
      },
    },
  });

  assert(deliveries.length === 1, "Expected missing config to produce an observable delivery record");
  assert(deliveries[0].status === "skipped", "Expected missing config delivery record to skip explicitly");
  assert(
    deliveries[0].failureCode === "missing_target_config",
    `Expected unresolved target failure code, got ${JSON.stringify(deliveries[0])}`,
  );

  console.log("mirror-routing-contract-check passed", {
    rulesCount: rulesPayload.rules.length,
    missingConfigDelivery: deliveries[0],
  });
}

main().catch((error) => {
  console.error("mirror-routing-contract-check failed");
  console.error(error);
  process.exit(1);
});