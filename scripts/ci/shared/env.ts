export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireAbsoluteUrlEnv(name: string): string {
  const value = requireEnv(name);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid absolute URL in ${name}: ${value}`);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`Invalid absolute URL in ${name}: ${value}`);
  }

  return value;
}