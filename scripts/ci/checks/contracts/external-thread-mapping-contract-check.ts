/* eslint-disable no-console */

import { createServer } from "node:http";

import { dispatchMessageMirrors } from "../../../../core/operator-agent/src/adapters/mirror-dispatcher";
import type {
import * as employeeIds from "../../shared/employee-ids";
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorDeliveryRecord,
} from "../../../../core/operator-agent/src/adapters/types";

export {};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createProjectionStore() {
  const mirrorDeliveries: MirrorDeliveryRecord[] = [];
  const externalThreadProjections: ExternalThreadProjection[] = [];
  const externalMessageProjections: ExternalMessageProjection[] = [];

  return {
    mirrorDeliveries,
    externalThreadProjections,
    externalMessageProjections,
    store: {
      async createMessageMirrorDelivery(delivery: MirrorDeliveryRecord) {
        mirrorDeliveries.push(delivery);
      },
      async getExternalThreadProjection(args: {
        threadId: string;
        channel: "slack" | "email";
        target: string;
      }) {
        return (
          externalThreadProjections.find(
            (projection) =>
              projection.threadId === args.threadId &&
              projection.channel === args.channel &&
              projection.target === args.target,
          ) ?? null
        );
      },
      async createExternalThreadProjection(projection: ExternalThreadProjection) {
        const existing = externalThreadProjections.find(
          (entry) =>
            entry.threadId === projection.threadId &&
            entry.channel === projection.channel &&
            entry.target === projection.target,
        );

        if (!existing) {
          externalThreadProjections.push(projection);
        }
      },
      async createExternalMessageProjection(projection: ExternalMessageProjection) {
        const existing = externalMessageProjections.find(
          (entry) =>
            entry.messageId === projection.messageId &&
            entry.channel === projection.channel &&
            entry.target === projection.target,
        );

        if (!existing) {
          externalMessageProjections.push(projection);
        }
      },
    },
  };
}

async function withWebhookStub<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const server = createServer((request, response) => {
    if (request.method === "POST") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
      return;
    }

    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not-found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve webhook stub address");
    }

    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main(): Promise<void> {
  const successfulRun = await withWebhookStub(async (webhookUrl) => {
    const projectionStore = createProjectionStore();

    await dispatchMessageMirrors({
      env: {
        MIRROR_DEFAULT_SLACK_CHANNEL: "aep-agent-feed",
        SLACK_MIRROR_WEBHOOK_URL: webhookUrl,
      } as any,
      store: projectionStore.store as any,
      input: {
        messageId: "msg_pr10b_contract_success",
        threadId: "thr_pr10b_contract_success",
        body: "PR10B should project canonical messages into a stable external conversation.",
        senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
        createdAt: new Date().toISOString(),
        routing: {
          threadId: "thr_pr10b_contract_success",
          messageType: "coordination",
          senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
          humanVisibilityRequired: true,
        },
      },
    });

    return projectionStore;
  });

  assert(successfulRun.externalThreadProjections.length === 1, "Expected one external thread projection");
  assert(successfulRun.externalMessageProjections.length === 1, "Expected one external message projection");
  assert(successfulRun.mirrorDeliveries.length === 1, "Expected one mirror delivery");

  const delivered = successfulRun.mirrorDeliveries[0];
  const threadProjection = successfulRun.externalThreadProjections[0];
  const messageProjection = successfulRun.externalMessageProjections[0];

  assert(delivered.status === "delivered", `Expected delivered mirror delivery, got ${JSON.stringify(delivered)}`);
  assert(threadProjection.channel === "slack" || threadProjection.channel === "email", "Expected bounded thread projection channel");
  assert(messageProjection.channel === "slack" || messageProjection.channel === "email", "Expected bounded message projection channel");
  assert(threadProjection.target.length > 0, "Expected thread projection target");
  assert(threadProjection.externalThreadId.length > 0, "Expected external thread projection id");
  assert(messageProjection.externalThreadId.length > 0, "Expected message projection external thread id");
  assert(messageProjection.externalMessageId.length > 0, "Expected message projection external message id");
  assert(threadProjection.threadId === "thr_pr10b_contract_success", "Expected canonical thread id to remain intact");
  assert(messageProjection.messageId === "msg_pr10b_contract_success", "Expected canonical message id to remain intact");
  assert(
    messageProjection.externalThreadId === threadProjection.externalThreadId,
    "Expected message projection to link to the thread projection external thread id",
  );
  assert(
    delivered.externalMessageId === messageProjection.externalMessageId,
    "Expected delivered mirror delivery to have a corresponding external message projection",
  );

  const failedRun = createProjectionStore();
  await dispatchMessageMirrors({
    env: {} as any,
    store: failedRun.store as any,
    input: {
      messageId: "msg_pr10b_contract_failed",
      threadId: "thr_pr10b_contract_failed",
      body: "PR10B must not synthesize mappings when no mirror target resolves.",
      senderEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
      createdAt: new Date().toISOString(),
      routing: {
        threadId: "thr_pr10b_contract_failed",
        messageType: "coordination",
        senderEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
        humanVisibilityRequired: true,
      },
    },
  });

  assert(failedRun.mirrorDeliveries.length === 1, "Expected one failed delivery for unresolved mirror routing");
  assert(failedRun.mirrorDeliveries[0].status === "failed", "Expected failed mirror delivery for unresolved routing");
  assert(failedRun.externalThreadProjections.length === 0, "Expected no thread projections for failed delivery");
  assert(failedRun.externalMessageProjections.length === 0, "Expected no message projections for failed delivery");

  console.log("external-thread-mapping-contract-check passed", {
    delivered,
    threadProjection,
    messageProjection,
    failedDelivery: failedRun.mirrorDeliveries[0],
  });
}

main().catch((error) => {
  console.error("external-thread-mapping-contract-check failed");
  console.error(error);
  process.exit(1);
});