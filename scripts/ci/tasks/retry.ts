/* eslint-disable no-console */

export type RetryOptions = {
  label: string;
  attempts?: number;
  delayMs?: number;
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`${options.label} failed after ${attempts} attempts: ${lastError.message}`);
  }

  throw new Error(`${options.label} failed after ${attempts} attempts`);
}