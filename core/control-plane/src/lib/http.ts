function withCors(headers?: HeadersInit): Headers {
  const next = new Headers(headers);

  if (!next.has("access-control-allow-origin")) {
    next.set("access-control-allow-origin", "*");
  }

  if (!next.has("access-control-allow-methods")) {
    next.set("access-control-allow-methods", "GET,POST,OPTIONS");
  }

  if (!next.has("access-control-allow-headers")) {
    next.set("access-control-allow-headers", "content-type,authorization");
  }

  if (!next.has("access-control-max-age")) {
    next.set("access-control-max-age", "86400");
  }

  return next;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = withCors(init.headers);

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

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  });
}