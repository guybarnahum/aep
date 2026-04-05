import { getConfig } from "@aep/operator-agent/config";
import { getBuildInfo } from "../lib/build-info";
import type { OperatorAgentEnv } from "../types";

export interface HealthzResponse {
  ok: boolean;
  service: string;
  env: string;
  version: string;
  time: string;
  policyVersion: string;
  checks: {
    config: "ok";
    runtime: "ok";
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}

export function handleHealthz(_request: Request, env: OperatorAgentEnv): Response {
  const config = getConfig(env);
  const build = getBuildInfo(env);

  const body: HealthzResponse = {
    ok: true,
    ...build,
    policyVersion: config.policyVersion,
    checks: {
      config: "ok",
      runtime: "ok",
    },
  };

  return json(body);
}
