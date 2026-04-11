import assert from "node:assert/strict";

export { assert };

export function assertString(
  value: unknown,
  label: string,
): asserts value is string {
  assert.equal(typeof value, "string", `${label} should be a string`);
}

export function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  assert.equal(typeof value, "boolean", `${label} should be a boolean`);
}

export function assertNumber(
  value: unknown,
  label: string,
): asserts value is number {
  assert.equal(typeof value, "number", `${label} should be a number`);
}

export function assertArray<T>(
  value: unknown,
  label: string,
): asserts value is T[] {
  assert(Array.isArray(value), `${label} should be an array`);
}

export function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${label} should be an object`,
  );
}

export function assertOneOf(
  value: unknown,
  allowed: readonly string[],
  label: string,
): void {
  assertString(value, label);
  assert(
    allowed.includes(value),
    `${label} should be one of ${allowed.join(", ")}, got ${value}`,
  );
}