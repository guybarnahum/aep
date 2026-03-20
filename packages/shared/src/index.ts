export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${rand}`;
}
