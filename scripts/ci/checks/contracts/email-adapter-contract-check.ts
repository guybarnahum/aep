/* eslint-disable no-console */

import { dispatchMessageMirrors } from "@aep/operator-agent/src/adapters/mirror-dispatcher";
import {
  buildEmailMirrorPayload,
  isPlaceholderEmailTarget,
  sendEmailMirror,
} from "@aep/operator-agent/src/adapters/email-adapter";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorDeliveryRecord,
} from "@aep/operator-agent/src/adapters/types";

// Local contract fixture only. This check does not call live runtime routes
// and must not depend on seeded employees or real email recipients.
const LOCAL_TEST_EMAIL_GROUP = "local-contract-email-target";
const LOCAL_TEST_SENDER = "local_contract_sender";
const LOCAL_TEST_THREAD_ID = "thr_email_missing_transport";
const LOCAL_TEST_MESSAGE_ID = "msg_email_missing_transport";
const LOCAL_TEST_EXTERNAL_THREAD_ID = "email-thread:local-contract-email-target:thr_email_missing_transport";
const PLACEHOLDER_DOMAIN_COM = ["example", "com"].join(".");
const PLACEHOLDER_DOMAIN_ORG = ["example", "org"].join(".");
const PLACEHOLDER_RECIPIENT_COM = `person@${PLACEHOLDER_DOMAIN_COM}`;
const PLACEHOLDER_RECIPIENT_ORG = `team@${PLACEHOLDER_DOMAIN_ORG}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertEmailPayloadConstruction(): Promise<void> {
  const payload = buildEmailMirrorPayload({
    recipientGroup: ` ${LOCAL_TEST_EMAIL_GROUP} `,
    subject: "  AEP canonical email mirror  ",
    body: "  Email body from canonical AEP message.  ",
    externalThreadId: LOCAL_TEST_EXTERNAL_THREAD_ID,
  });

  assert(!("ok" in payload), `Expected valid email payload, got ${JSON.stringify(payload)}`);
  assert(payload.recipientGroup === LOCAL_TEST_EMAIL_GROUP, "Email payload must trim recipient group");
  assert(payload.subject === "AEP canonical email mirror", "Email payload must trim subject");
  assert(payload.body === "Email body from canonical AEP message.", "Email payload must trim body");
  assert(
    payload.headers["x-aep-external-thread-id"] === LOCAL_TEST_EXTERNAL_THREAD_ID,
    "Email payload must carry canonical external thread continuity header",
  );
}

async function assertPlaceholderTargetsDenied(): Promise<void> {
  assert(
    isPlaceholderEmailTarget(PLACEHOLDER_RECIPIENT_COM),
    "example.com targets must be placeholder-denied",
  );
  assert(
    isPlaceholderEmailTarget(PLACEHOLDER_RECIPIENT_ORG),
    "example.org targets must be placeholder-denied",
  );
  assert(isPlaceholderEmailTarget(""), "empty targets must be denied");

  const result = await sendEmailMirror({
    recipientGroup: PLACEHOLDER_RECIPIENT_COM,
    subject: "AEP mirror",
    body: "AEP body",
  });

  assert(result.ok === false, "Placeholder email target must not report success");
  assert(
    result.code === "email_target_invalid",
    `Expected email_target_invalid, got ${JSON.stringify(result)}`,
  );
}

async function assertMissingEmailTransportSkipsDelivery(): Promise<void> {
  const deliveries: MirrorDeliveryRecord[] = [];
  const threadProjections: ExternalThreadProjection[] = [];
  const messageProjections: ExternalMessageProjection[] = [];

  await dispatchMessageMirrors({
    env: {
      MIRROR_ESCALATIONS_EMAIL_GROUP: LOCAL_TEST_EMAIL_GROUP,
      OPERATOR_AGENT_DB: {
        prepare() {
          return {
            async all<T>() {
              return {
                results: [
                  {
                    rule_id: "mirror_escalations_to_email",
                    enabled: 1,
                    thread_kind: "escalation",
                    message_type: null,
                    severity: "critical",
                    visibility: "human_visible",
                    target_adapter: "email",
                    target_key: "MIRROR_ESCALATIONS_EMAIL_GROUP",
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
      messageId: LOCAL_TEST_MESSAGE_ID,
      threadId: LOCAL_TEST_THREAD_ID,
      body: "AEP canonical escalation mirror",
      senderEmployeeId: LOCAL_TEST_SENDER,
      createdAt: new Date().toISOString(),
      routing: {
        threadId: LOCAL_TEST_THREAD_ID,
        threadType: "escalation",
        messageType: "escalation",
        senderEmployeeId: LOCAL_TEST_SENDER,
        humanVisibilityRequired: true,
      },
    },
  });

  assert(deliveries.length === 1, "Missing email transport must create one delivery record");
  assert(deliveries[0].channel === "email", "Skipped delivery must be email-scoped");
  assert(deliveries[0].status === "skipped", "Missing email transport must be skipped, not failed");
  assert(
    deliveries[0].failureCode === "email_adapter_not_configured",
    `Expected email_adapter_not_configured, got ${JSON.stringify(deliveries[0])}`,
  );
  assert(
    threadProjections.length === 0 && messageProjections.length === 0,
    "Skipped email delivery must not create external projections",
  );
}

async function main(): Promise<void> {
  await assertEmailPayloadConstruction();
  await assertPlaceholderTargetsDenied();
  await assertMissingEmailTransportSkipsDelivery();

  console.log("email-adapter-contract-check passed");
}

void main();
