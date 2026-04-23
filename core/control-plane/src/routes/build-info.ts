import { getBuildInfo } from "@aep/control-plane/lib/build-info";
import type { Env } from "@aep/types/index";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}

export function handleBuildInfo(_request: Request, env: Env): Response {
  return json(getBuildInfo(env));
}