/* eslint-disable no-console */

import { dispatchMessageMirrors } from "../../../../core/operator-agent/src/adapters/mirror-dispatcher";
import { resolveMirrorTargets } from "../../../../core/operator-agent/src/adapters/mirror-routing-policy";
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
  const configuredEnv: EnvShape = {
    MIRROR_DEFAULT_SLACK_CHANNEL: "default-channel",
    MIRROR_APPROVALS_SLACK_CHANNEL: "approvals-channel",
    MIRROR_ESCALATIONS_SLACK_CHANNEL: "escalations-channel",
    MIRROR_ESCALATIONS_EMAIL_GROUP: "escalations@example.com",
  };

  const approvalTargets = resolveMirrorTargets(configuredEnv as any, {
    threadId: "thr_approval",
    threadType: "approval",
    messageType: "coordination",
    senderEmployeeId: FIXTURE_PRODUCT_MANAGER_ID,
    humanVisibilityRequired: true,
  });

  assert(
    approvalTargets.length >= 1 && approvalTargets.every((target) => target.kind === "slack"),
    `Expected approval routing to resolve bounded slack target(s), got ${JSON.stringify(approvalTargets)}`,
  );

  const escalationTargets = resolveMirrorTargets(configuredEnv as any, {
    threadId: "thr_escalation",
    threadType: "escalation",
    messageType: "escalation",
    senderEmployeeId: FIXTURE_INFRA_OPS_MANAGER_ID,
    humanVisibilityRequired: true,
  });

  assert(
    escalationTargets.some((target) => target.kind === "slack") &&
      escalationTargets.some((target) => target.kind === "email"),
    `Expected escalation routing to resolve slack and email targets, got ${JSON.stringify(escalationTargets)}`,
  );

  const defaultTargets = resolveMirrorTargets(configuredEnv as any, {
    threadId: "thr_default",
    messageType: "coordination",
    senderEmployeeId: FIXTURE_RELIABILITY_ENGINEER_ID,
    humanVisibilityRequired: true,
  });

  assert(
    defaultTargets.length === 1 && defaultTargets[0]?.kind === "slack",
    `Expected default routing to resolve one slack target, got ${JSON.stringify(defaultTargets)}`,
  );

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
  assert(deliveries[0].status === "failed", "Expected missing config delivery record to fail explicitly");
  assert(
    deliveries[0].failureCode === "mirror_target_unresolved",
    `Expected unresolved target failure code, got ${JSON.stringify(deliveries[0])}`,
  );

  console.log("mirror-routing-contract-check passed", {
    approvalTargets,
    escalationTargets,
    defaultTargets,
    missingConfigDelivery: deliveries[0],
  });
}

main().catch((error) => {
  console.error("mirror-routing-contract-check failed");
  console.error(error);
  process.exit(1);
});