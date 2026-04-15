import type { TaskStore } from "../lib/store-types";

export async function resolveCanonicalThreadForExternalAction(
  store: TaskStore,
  externalThreadId: string,
  source: "slack" | "email",
): Promise<
  | { ok: true; thread: Awaited<ReturnType<TaskStore["findThreadByExternalThreadId"]>> extends infer T ? Exclude<T, null> : never }
  | { ok: false; error: "thread_not_found" }
> {
  const thread = await store.findThreadByExternalThreadId({
    externalThreadId,
    source,
  });

  if (!thread) {
    return { ok: false, error: "thread_not_found" };
  }

  return { ok: true, thread };
}