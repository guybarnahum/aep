/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

type ThreadRecord = {
  id: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
};

function assertNoDuplicateLinkages(args: {
  threads: ThreadRecord[];
  field: "relatedApprovalId" | "relatedEscalationId";
  label: string;
}): void {
  const counts = new Map<string, number>();

  for (const thread of args.threads) {
    const key = thread[args.field];
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates = Array.from(counts.entries()).filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate ${args.label} thread linkages detected: ${JSON.stringify(duplicates)}`,
    );
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("thread-linkage-invariant-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const threadsResponse = await client.listMessageThreads({ limit: 200 });

  if (!(threadsResponse as any)?.ok || !Array.isArray((threadsResponse as any).threads)) {
    throw new Error(`Failed to list message threads: ${JSON.stringify(threadsResponse)}`);
  }

  const threads = (threadsResponse as any).threads as ThreadRecord[];

  assertNoDuplicateLinkages({
    threads,
    field: "relatedApprovalId",
    label: "approval",
  });

  assertNoDuplicateLinkages({
    threads,
    field: "relatedEscalationId",
    label: "escalation",
  });

  console.log("thread-linkage-invariant-check passed", {
    threadCount: threads.length,
  });
}

main().catch((error) => {
  console.error("thread-linkage-invariant-check failed");
  console.error(error);
  process.exit(1);
});