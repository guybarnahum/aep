export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
