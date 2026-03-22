import { Provider, DEFAULT_PROVIDER, isProvider } from "./providers";
export { Provider, DEFAULT_PROVIDER, isProvider };

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${rand}`;
}
