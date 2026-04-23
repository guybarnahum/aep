export function nowIso(): string {
  return new Date().toISOString();
}

const BASE64_URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function newToken(length = 8): string {
  assertPositiveInteger(length, "length");

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let token = "";
  for (const byte of bytes) {
    token += BASE64_URL_ALPHABET[byte & 63];
  }

  return token;
}

export function newId(
  prefix: string,
  options?: { length?: number; separator?: "_" | "-" },
): string {
  return `${prefix}${options?.separator ?? "_"}${newToken(options?.length)}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export * from "./providers";