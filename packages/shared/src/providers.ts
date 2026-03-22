export const PROVIDERS = ["cloudflare", "aws", "gcp"] as const;

export type Provider = (typeof PROVIDERS)[number];

export const DEFAULT_PROVIDER: Provider = "cloudflare";

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.includes(value as Provider);
}
