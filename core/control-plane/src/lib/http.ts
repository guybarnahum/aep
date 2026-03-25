export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export function notFound(message: string): Response {
  return json(
    {
      error: "not_found",
      message,
    },
    { status: 404 },
  );
}