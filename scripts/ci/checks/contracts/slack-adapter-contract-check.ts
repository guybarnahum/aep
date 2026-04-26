/* eslint-disable no-console */

import { dispatchMessageMirrors } from "@aep/operator-agent/src/adapters/mirror-dispatcher";
import {
  buildSlackMirrorPayload,
  sendSlackMirror,
} from "@aep/operator-agent/src/adapters/slack-webhook-adapter";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorDeliveryRecord,
} from "@aep/operator-agent/src/adapters/types";

// Local contract fixture only. This check does not call live runtime routes
// and must not depend on seeded employees or real Slack channel IDs.
const LOCAL_TEST_SLACK_CHANNEL = "local_contract_slack_channel";
const LOCAL_TEST_SENDER = "local_contract_sender";
const LOCAL_TEST_THREAD_TS = "1710000000.123456";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertSlackPayloadThreading(): Promise<void> {
  const payload = buildSlackMirrorPayload({
    channelId: LOCAL_TEST_SLACK_CHANNEL,
    text: "  AEP canonical mirror  ",
    externalThreadId: `slack-ts:${LOCAL_TEST_THREAD_TS}`,
  });

  assert(
    payload.channel === LOCAL_TEST_SLACK_CHANNEL,
    "Slack payload must preserve target channel",
  );
  assert(payload.text === "AEP canonical mirror", "Slack payload must trim message text");
  assert(
    payload.thread_ts === LOCAL_TEST_THREAD_TS,
    "Slack payload must set thread_ts only from valid Slack timestamps",
  );

  const syntheticPayload = buildSlackMirrorPayload({
    channelId: LOCAL_TEST_SLACK_CHANNEL,
    text: "AEP canonical mirror",
    externalThreadId: `slack-thread:${LOCAL_TEST_SLACK_CHANNEL}:synthetic`,
  });

  assert(
    typeof syntheticPayload.thread_ts === "undefined",
    "Synthetic external thread ids must not be sent to Slack as thread_ts",
  );
}

async function assertMissingWebhookSkipsTransport(): Promise<void> {
  const result = await sendSlackMirror({
    webhookUrl: "",
    channelId: LOCAL_TEST_SLACK_CHANNEL,
    text: "AEP canonical mirror",
  });

  assert(result.ok === false, "Missing Slack webhook must not report success");
  assert(
    result.code === "slack_webhook_missing",
    `Expected slack_webhook_missing, got ${JSON.stringify(result)}`,
  );
}

async function assertMissingWebhookCreatesSkippedDelivery(): Promise<void> {
  const deliveries: MirrorDeliveryRecord[] = [];
  const threadProjections: ExternalThreadProjection[] = [];
  const messageProjections: ExternalMessageProjection[] = [];

  await dispatchMessageMirrors({
    env: {
      SLACK_MIRROR_WEBHOOK_URL: "",
      MIRROR_DEFAULT_SLACK_CHANNEL: LOCAL_TEST_SLACK_CHANNEL,
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
                    visibility: "human_visible",
                    target_adapter: "slack",
                    target_key: "MIRROR_DEFAULT_SLACK_CHANNEL",
                  },
                ] as T[],
              };
            },
          };
        },
      },
    } as any,
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
      messageId: "msg_slack_missing_webhook",
      threadId: "thr_slack_missing_webhook",
      body: "AEP canonical mirror",
      senderEmployeeId: LOCAL_TEST_SENDER,
      createdAt: new Date().toISOString(),
      routing: {
        threadId: "thr_slack_missing_webhook",
        threadType: "coordination",
        messageType: "coordination",
        senderEmployeeId: LOCAL_TEST_SENDER,
        humanVisibilityRequired: true,
      },
    },
  });

  assert(deliveries.length === 1, "Missing Slack webhook must create one delivery record");
  assert(deliveries[0].channel === "slack", "Skipped delivery must be Slack-scoped");
  assert(deliveries[0].status === "skipped", "Missing Slack webhook must be skipped, not failed");
  assert(
    deliveries[0].failureCode === "slack_adapter_not_configured",
    `Expected slack_adapter_not_configured, got ${JSON.stringify(deliveries[0])}`,
  );
  assert(
    threadProjections.length === 0 && messageProjections.length === 0,
    "Skipped Slack delivery must not create external projections",
  );
}

async function main(): Promise<void> {
  await assertSlackPayloadThreading();
  await assertMissingWebhookSkipsTransport();
  await assertMissingWebhookCreatesSkippedDelivery();

  console.log("slack-adapter-contract-check passed");
}

void main();
