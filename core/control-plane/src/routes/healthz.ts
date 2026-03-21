import { getBuildInfo, type BuildInfoEnv } from "../lib/build-info";

export interface HealthzEnv extends BuildInfoEnv {
  DB?: D1Database;
}

export interface HealthzResponse {
  ok: boolean;
  service: string;
  env: string;
  version: string;
  time: string;
  checks: {
    config: "ok" | "fail";
    runtime: "ok" | "fail";
    d1: "ok" | "fail" | "unknown";
  };
}

async function checkD1(db?: D1Database): Promise<"ok" | "fail" | "unknown"> {
  if (!db) {
    return "unknown";
  }

  try {
    await db.prepare("select 1 as ok").first();
    return "ok";
  } catch {
    return "fail";
  }
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

export async function handleHealthz(_request: Request, env: HealthzEnv): Promise<Response> {
  const build = getBuildInfo(env);
  const d1 = await checkD1(env.DB);

  const body: HealthzResponse = {
    ok: d1 !== "fail",
    ...build,
    checks: {
      config: "ok",
      runtime: "ok",
      d1,
    },
  };

  return json(body, body.ok ? 200 : 503);
}