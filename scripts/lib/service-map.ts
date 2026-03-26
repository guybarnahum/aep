import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ServiceMapEntry {
  baseUrl: string;
}

export interface ServiceMap {
  version: 1;
  services: Record<string, ServiceMapEntry>;
}

const DEFAULT_SERVICE_MAP_PATH = ".aep/service-map.json";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function resolveServiceMapPath(customPath?: string): string {
  return resolve(customPath ?? process.env.AEP_SERVICE_MAP_PATH ?? DEFAULT_SERVICE_MAP_PATH);
}

export function readServiceMap(customPath?: string): ServiceMap | null {
  const serviceMapPath = resolveServiceMapPath(customPath);

  if (!existsSync(serviceMapPath)) {
    return null;
  }

  return JSON.parse(readFileSync(serviceMapPath, "utf8")) as ServiceMap;
}

export function resolveServiceBaseUrl(args: {
  envVar: string;
  serviceName: string;
}): string {
  const direct = process.env[args.envVar];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return normalizeBaseUrl(direct);
  }

  const serviceMap = readServiceMap();
  const mapped = serviceMap?.services[args.serviceName]?.baseUrl;
  if (typeof mapped === "string" && mapped.trim().length > 0) {
    return normalizeBaseUrl(mapped);
  }

  const serviceMapPath = resolveServiceMapPath();
  throw new Error(
    `Missing ${args.envVar} and no ${args.serviceName} entry found in ${serviceMapPath}. Run npm run dev:write-service-map or export ${args.envVar}.`
  );
}

export function writeServiceMap(args: {
  path?: string;
  services: Record<string, ServiceMapEntry>;
}): string {
  const serviceMapPath = resolveServiceMapPath(args.path);

  mkdirSync(dirname(serviceMapPath), { recursive: true });
  writeFileSync(
    serviceMapPath,
    JSON.stringify(
      {
        version: 1,
        services: Object.fromEntries(
          Object.entries(args.services).map(([serviceName, entry]) => [
            serviceName,
            { baseUrl: normalizeBaseUrl(entry.baseUrl) },
          ])
        ),
      } satisfies ServiceMap,
      null,
      2
    ) + "\n",
    "utf8"
  );

  return serviceMapPath;
}