export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({ ok: true, service: "sample-worker" });
    }

    if (request.method === "GET" && url.pathname === "/hello") {
      return Response.json({ message: "ok" });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
