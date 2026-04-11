/* eslint-disable no-console */

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export async function getJson<T>(
  url: string,
  init?: Omit<RequestInit, "method">,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    ...init,
  });

  return readJson<T>(response);
}

export async function postJson<T>(
  url: string,
  body: unknown,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  return readJson<T>(response);
}

export function formatRequestError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    return new Error(`${context}: ${error.message}`);
  }

  return new Error(`${context}: ${String(error)}`);
}