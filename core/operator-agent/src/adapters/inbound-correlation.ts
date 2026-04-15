import type { MirrorChannel } from "./types";
import type { TaskStore } from "../lib/store-types";

export async function resolveCanonicalThreadForInbound(
  store: TaskStore,
  input: {
    channel: MirrorChannel;
    externalThreadId: string;
    target?: string;
  },
): Promise<{ threadId: string } | null> {
  const projections = await store.listExternalThreadProjectionsByExternal({
    channel: input.channel,
    externalThreadId: input.externalThreadId,
    target: input.target,
  });

  if (projections.length === 0) {
    return null;
  }

  return { threadId: projections[0].threadId };
}