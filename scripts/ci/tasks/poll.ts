/* eslint-disable no-console */

export type PollOptions<T> = {
  label: string;
  intervalMs?: number;
  timeoutMs?: number;
  shouldStop: (value: T) => boolean;
};

export async function poll<T>(
  fn: () => Promise<T>,
  options: PollOptions<T>,
): Promise<T> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 30000;
  const startedAt = Date.now();

  while (true) {
    const value = await fn();

    if (options.shouldStop(value)) {
      return value;
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `${options.label} timed out after ${timeoutMs}ms`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}