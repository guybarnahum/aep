import type { Env } from "../../types/src/index";
import { json, notFound } from "../lib/http";
import { advanceTimeoutForJob } from "../operator/advance-timeout";

function extractJobId(pathname: string): string | null {
  const match = pathname.match(/^\/operator\/jobs\/([^/]+)\/advance-timeout$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleOperatorRoute(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method === "POST") {
    const jobId = extractJobId(url.pathname);
    if (jobId) {
      const result = await advanceTimeoutForJob({
        env,
        jobId,
        requestedBy: "ops-console",
      });

      if (result.result === "rejected_not_found") {
        return notFound(`job not found: ${jobId}`);
      }

      if (!result.ok) {
        return json(result, { status: 409 });
      }

      return json(result, { status: 200 });
    }
  }

  return notFound(`operator route not found: ${url.pathname}`);
}
