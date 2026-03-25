import { handleHealthz } from "./routes/healthz";
import { handleRunOnce } from "./routes/run-once";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return handleHealthz();
    }

    if (url.pathname === "/agent/run-once") {
      return handleRunOnce(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
